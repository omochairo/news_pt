import { NextResponse } from 'next/server';
import axios from 'axios';
import { MARKETS, WorldQuote, parseSparkResponse } from '@/lib/world-markets';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// spark API は 1 リクエスト 20 銘柄まで
const BATCH_SIZE = 20;

// 全クライアントが1分おきに叩くので、外部への問い合わせはサーバー側で1分に1回へまとめる
const CACHE_TTL_MS = 60 * 1000;
let memoryCache: { quotes: Record<string, WorldQuote>; updatedAt: string; timestamp: number } | null = null;
// キャッシュが切れた瞬間に同時に来たリクエストが、それぞれ外部へ取りに行かないようにする
let inflight: Promise<WorldQuote[]> | null = null;

async function fetchBatch(symbols: string[]): Promise<WorldQuote[]> {
    const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(',')}&range=1d&interval=5m`;
    const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
    return parseSparkResponse(res.data);
}

async function fetchAll(): Promise<WorldQuote[]> {
    const symbols = MARKETS.map(m => m.symbol);
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) batches.push(symbols.slice(i, i + BATCH_SIZE));

    const results = await Promise.allSettled(batches.map(fetchBatch));
    const quotes: WorldQuote[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            quotes.push(...r.value);
        } else {
            const error = r.reason;
            console.error(`World markets fetch failed for ${batches[i].join(',')}:`, error instanceof Error ? error.message : error);
        }
    });
    return quotes;
}

export async function GET() {
    const now = Date.now();
    const headers = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' };

    if (!memoryCache || now - memoryCache.timestamp >= CACHE_TTL_MS) {
        try {
            if (!inflight) inflight = fetchAll().finally(() => { inflight = null; });
            const fresh = await inflight;
            // 取れなかった銘柄は直前の値を残す（一部のバッチが落ちても画面から消えないように）
            const merged = { ...(memoryCache?.quotes ?? {}) };
            for (const q of fresh) merged[q.symbol] = q;
            // 全滅した回も timestamp は進める（取得元に遮断されている間、毎リクエスト取りに行かないように）
            const updatedAt = fresh.length > 0 || !memoryCache ? new Date(now).toISOString() : memoryCache.updatedAt;
            memoryCache = { quotes: merged, updatedAt, timestamp: now };
        } catch (error) {
            console.error('World markets API Error:', error);
            if (!memoryCache) {
                return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
            }
        }
    }

    return NextResponse.json(
        { quotes: Object.values(memoryCache!.quotes), updatedAt: memoryCache!.updatedAt },
        { headers },
    );
}
