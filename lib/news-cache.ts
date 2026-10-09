import {
    fetchBloombergNews,
    fetchReutersNews,
    fetchCNNNews,
    fetchNikkeiNews,
    fetchMinkabuFXNews,
    fetchCryptoNews,
    fetchBOJNews,
    fetchKabutanNews,
    fetchTradersWebNews,
    fetchZaiFXNews,
    fetchToyoKeizaiNews,
    fetchDiamondNews,
    NewsItem,
} from './parser';
import { SOURCES, type NewsKey } from './sources';

/** /api/news と /api/health が共有するニュースの取得とキャッシュ */

export type NewsData = Record<NewsKey, NewsItem[]> & { updatedAt: string };

export const NEWS_SOURCES: readonly NewsKey[] = SOURCES.map(s => s.key);

const FETCHERS: Record<NewsKey, () => Promise<NewsItem[]>> = {
    nikkei: fetchNikkeiNews,
    minkabu: fetchMinkabuFXNews,
    crypto: fetchCryptoNews,
    bloomberg: fetchBloombergNews,
    reuters: fetchReutersNews,
    cnn: fetchCNNNews,
    boj: fetchBOJNews,
    kabutan: fetchKabutanNews,
    traders: fetchTradersWebNews,
    zai: fetchZaiFXNews,
    toyokeizai: fetchToyoKeizaiNews,
    diamond: fetchDiamondNews,
};

// メモリ内キャッシュ (サーバーが起動している間保持)
let memoryCache: { data: NewsData; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ
// ?refresh=true は誰でも付けられるので、キャッシュがこれより新しい間は無視する（外部への連打で BAN されないように）
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
// 同時に来たリクエストが、それぞれ外部へ取りに行かないようにする
let inflight: Promise<NewsData> | null = null;

async function fetchAllNews(): Promise<NewsData> {
    // Promise.allSettled で一部が失敗しても全滅しないように取得
    // （同期的に例外を投げる取得関数も、ここで拾わずに外へ伝える。古いキャッシュへのフォールバックに使う）
    const results = await Promise.allSettled(NEWS_SOURCES.map(key => FETCHERS[key]()));
    const data = Object.fromEntries(NEWS_SOURCES.map((key, i) => {
        const r = results[i];
        return [key, r.status === 'fulfilled' ? r.value : []];
    })) as Record<NewsKey, NewsItem[]>;
    return { ...data, updatedAt: new Date().toISOString() };
}

export type NewsSource = NewsKey;

// 媒体ごとに、0 件が続いている最初の時刻（取れたら消す）。/api/health が長く続く停止を見つけるのに使う
let emptySince: Partial<Record<NewsSource, string>> = {};

/**
 * 0 件だった媒体は前回の記事を残す（一時的な失敗で画面から媒体ごと消えないように）。
 * 残したかどうかに関わらず、0 件になった時刻は emptySince に記録する
 */
function keepPreviousOnEmpty(fresh: NewsData, now: number): NewsData {
    const merged = { ...fresh };
    const next: typeof emptySince = {};
    for (const source of NEWS_SOURCES) {
        if (fresh[source].length > 0) continue;
        next[source] = emptySince[source] ?? new Date(now).toISOString();
        const previous = memoryCache?.data[source];
        if (previous && previous.length > 0) merged[source] = previous;
    }
    emptySince = next;
    return merged;
}

export function getNewsEmptySince(): Partial<Record<NewsSource, string>> {
    return emptySince;
}

export type NewsResult =
    | { data: NewsData; cache: 'HIT' | 'MISS' | 'STALE-FALLBACK' }
    | null;

/** キャッシュ（5分）か、切れていれば取り直した値。取れず、キャッシュも無ければ null */
export async function getNews(requestRefresh = false): Promise<NewsResult> {
    const now = Date.now();
    const cacheAge = memoryCache ? now - memoryCache.timestamp : Infinity;
    const forceRefresh = requestRefresh && cacheAge >= MIN_REFRESH_INTERVAL_MS;

    // 有効なキャッシュがあれば即座に返却 (外部リクエストBAN防止)
    if (memoryCache && !forceRefresh && cacheAge < CACHE_TTL_MS) {
        return { data: memoryCache.data, cache: 'HIT' };
    }

    try {
        if (!inflight) {
            inflight = fetchAllNews().then(fresh => keepPreviousOnEmpty(fresh, now)).finally(() => { inflight = null; });
        }
        const result = await inflight;
        memoryCache = { data: result, timestamp: now };
        return { data: result, cache: 'MISS' };
    } catch (error) {
        console.error('API Error in /api/news:', error);
        return memoryCache ? { data: memoryCache.data, cache: 'STALE-FALLBACK' } : null;
    }
}
