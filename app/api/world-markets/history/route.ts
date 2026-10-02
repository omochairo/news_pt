import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { HISTORY_RANGES, HistoryRange, MARKETS, QuoteHistory, parseHistory } from '@/lib/world-markets';
import { JGB10Y_SYMBOL } from '@/lib/jgb';
import { getJgbHistory } from '@/lib/jgb-cache';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const KNOWN = new Set(MARKETS.map(m => m.symbol));

// 詳細チャートは開いたときだけ取りに行く。長い期間ほど足が粗いので長めに持つ
const CACHE_TTL_MS: Record<HistoryRange, number> = {
    '5d': 5 * 60 * 1000,
    '1mo': 30 * 60 * 1000,
    '1y': 6 * 60 * 60 * 1000,
};

// キーは銘柄×期間に限られる（最大 53×3）ので、上限を設けずに持つ
const cache = new Map<string, { data: QuoteHistory; timestamp: number }>();
const inflight = new Map<string, Promise<QuoteHistory | null>>();

async function fetchHistory(symbol: string, range: HistoryRange): Promise<QuoteHistory | null> {
    // 日本国債 10 年は Yahoo に無いので、財務省の日次 CSV から作る
    if (symbol === JGB10Y_SYMBOL) return getJgbHistory(range);
    const interval = HISTORY_RANGES.find(r => r.id === range)!.interval;
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${encodeURIComponent(symbol)}&range=${range}&interval=${interval}`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
    return parseHistory(res.data, symbol, range);
}

export async function GET(request: NextRequest) {
    const symbol = request.nextUrl.searchParams.get('symbol') ?? '';
    const range = request.nextUrl.searchParams.get('range') as HistoryRange;
    // 任意の銘柄で外部へ取りに行かせない
    if (!KNOWN.has(symbol) || !HISTORY_RANGES.some(r => r.id === range)) {
        return NextResponse.json({ error: 'Unknown symbol or range' }, { status: 400 });
    }

    const key = `${symbol}|${range}`;
    const ttl = CACHE_TTL_MS[range];
    const headers = { 'Cache-Control': `public, max-age=${Math.floor(ttl / 2000)}, s-maxage=${ttl / 1000}` };
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
        return NextResponse.json(cached.data, { headers });
    }

    try {
        let pending = inflight.get(key);
        if (!pending) {
            pending = fetchHistory(symbol, range).finally(() => inflight.delete(key));
            inflight.set(key, pending);
        }
        const data = await pending;
        if (data) {
            cache.set(key, { data, timestamp: Date.now() });
            return NextResponse.json(data, { headers });
        }
    } catch (error) {
        console.error(`History fetch failed for ${key}:`, error instanceof Error ? error.message : error);
    }

    // 取れなかったときは古いキャッシュでも出す
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 502 });
}
