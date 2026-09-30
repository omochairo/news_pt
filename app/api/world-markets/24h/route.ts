import { NextResponse } from 'next/server';
import axios from 'axios';
import { MARKETS, Quote24h, parse24h } from '@/lib/world-markets';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// 週末をまたいでも直近 24 時間の取引が入るよう 5 日分を 15 分足で取る
const SPARK_QUERY = 'range=5d&interval=15m';
const BATCH_SIZE = 20;

const CACHE_TTL_MS = 60 * 1000;
let memoryCache: { quotes: Record<string, Quote24h>; updatedAt: string; timestamp: number } | null = null;
let inflight: Promise<Quote24h[]> | null = null;

async function fetchAll(): Promise<Quote24h[]> {
    const symbols = MARKETS.filter(m => m.h24).map(m => m.symbol);
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) batches.push(symbols.slice(i, i + BATCH_SIZE));

    const results = await Promise.allSettled(batches.map(async batch => {
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${batch.map(encodeURIComponent).join(',')}&${SPARK_QUERY}`;
        const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
        return parse24h(res.data);
    }));

    const quotes: Quote24h[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            quotes.push(...r.value);
        } else {
            const error = r.reason;
            console.error(`24h markets fetch failed for ${batches[i].join(',')}:`, error instanceof Error ? error.message : error);
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
            // 取れなかった銘柄は直前の値を残す。全滅した回も timestamp は進め、遮断中に毎回取りに行かない
            const merged = { ...(memoryCache?.quotes ?? {}) };
            for (const q of fresh) merged[q.symbol] = q;
            const updatedAt = fresh.length > 0 || !memoryCache ? new Date(now).toISOString() : memoryCache.updatedAt;
            memoryCache = { quotes: merged, updatedAt, timestamp: now };
        } catch (error) {
            console.error('24h markets API Error:', error);
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
