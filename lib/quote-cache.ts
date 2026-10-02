/**
 * 外部から銘柄ごとの値をまとめて取るときの、1 分キャッシュと同時リクエストの集約。
 * /api/world-markets・/api/market・/api/world-markets/24h・/api/health が使う
 */

const CACHE_TTL_MS = 60 * 1000;

export interface QuotesSnapshot<Q> {
    quotes: Record<string, Q>;
    updatedAt: string;
}

/** 直近に外部へ取りに行った回の結果（キャッシュは前回値を残すので、遮断に気づくにはこちらを見る） */
export interface LastFetch {
    at: string;
    count: number;
}

export function createQuoteCache<Q extends { symbol: string }>(fetchAll: () => Promise<Q[]>, label: string) {
    let memoryCache: (QuotesSnapshot<Q> & { timestamp: number }) | null = null;
    // キャッシュが切れた瞬間に同時に来たリクエストが、それぞれ外部へ取りに行かないようにする
    let inflight: Promise<Q[]> | null = null;
    let lastFetch: LastFetch | null = null;

    /** キャッシュ（1分）か、切れていれば取り直した値。一度も取れていないまま失敗したら null */
    async function get(): Promise<QuotesSnapshot<Q> | null> {
        const now = Date.now();
        if (!memoryCache || now - memoryCache.timestamp >= CACHE_TTL_MS) {
            try {
                if (!inflight) inflight = fetchAll().finally(() => { inflight = null; });
                const fresh = await inflight;
                lastFetch = { at: new Date(now).toISOString(), count: fresh.length };
                // 取れなかった銘柄は直前の値を残す（一部のバッチが落ちても画面から消えないように）
                const merged = { ...(memoryCache?.quotes ?? {}) };
                for (const q of fresh) merged[q.symbol] = q;
                // 全滅した回も timestamp は進める（取得元に遮断されている間、毎リクエスト取りに行かないように）
                const updatedAt = fresh.length > 0 || !memoryCache ? new Date(now).toISOString() : memoryCache.updatedAt;
                memoryCache = { quotes: merged, updatedAt, timestamp: now };
            } catch (error) {
                lastFetch = { at: new Date(now).toISOString(), count: 0 };
                console.error(`${label} API Error:`, error);
            }
        }
        return memoryCache && { quotes: memoryCache.quotes, updatedAt: memoryCache.updatedAt };
    }

    return { get, getLastFetch: () => lastFetch };
}

/** spark API のバッチを並列に取り、落ちたバッチはログに残して残りを返す */
export async function fetchInBatches<Q>(symbols: string[], batchSize: number, fetchBatch: (batch: string[]) => Promise<Q[]>, label: string): Promise<Q[]> {
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += batchSize) batches.push(symbols.slice(i, i + batchSize));

    const results = await Promise.allSettled(batches.map(fetchBatch));
    const quotes: Q[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
            quotes.push(...r.value);
        } else {
            const error = r.reason;
            console.error(`${label} fetch failed for ${batches[i].join(',')}:`, error instanceof Error ? error.message : error);
        }
    });
    return quotes;
}
