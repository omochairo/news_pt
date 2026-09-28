import { NextResponse } from 'next/server';
import {
    fetchBloombergNews,
    fetchReutersNews,
    fetchCNNNews,
    fetchNikkeiNews,
    fetchMinkabuFXNews,
    fetchCryptoNews,
    NewsItem,
} from '@/lib/parser';

interface CacheContainer {
    data: {
        nikkei: NewsItem[];
        minkabu: NewsItem[];
        bloomberg: NewsItem[];
        reuters: NewsItem[];
        cnn: NewsItem[];
        crypto: NewsItem[];
        updatedAt: string;
    };
    timestamp: number;
}

// メモリ内キャッシュ (サーバーが起動している間保持)
let memoryCache: CacheContainer | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ
// ?refresh=true は誰でも付けられるので、キャッシュがこれより新しい間は無視する（外部への連打で BAN されないように）
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
// 同時に来たリクエストが、それぞれ外部へ取りに行かないようにする
let inflight: Promise<CacheContainer['data']> | null = null;

async function fetchAllNews(): Promise<CacheContainer['data']> {
    // Promise.allSettled で一部が失敗しても全滅しないように取得
    const [nikkeiRes, minkabuRes, bloombergRes, reutersRes, cnnRes, cryptoRes] = await Promise.allSettled([
        fetchNikkeiNews(),
        fetchMinkabuFXNews(),
        fetchBloombergNews(),
        fetchReutersNews(),
        fetchCNNNews(),
        fetchCryptoNews(),
    ]);

    return {
        nikkei: nikkeiRes.status === 'fulfilled' ? nikkeiRes.value : [],
        minkabu: minkabuRes.status === 'fulfilled' ? minkabuRes.value : [],
        bloomberg: bloombergRes.status === 'fulfilled' ? bloombergRes.value : [],
        reuters: reutersRes.status === 'fulfilled' ? reutersRes.value : [],
        cnn: cnnRes.status === 'fulfilled' ? cnnRes.value : [],
        crypto: cryptoRes.status === 'fulfilled' ? cryptoRes.value : [],
        updatedAt: new Date().toISOString(),
    };
}

export async function GET(request: Request) {
    const now = Date.now();
    const url = new URL(request.url);
    const cacheAge = memoryCache ? now - memoryCache.timestamp : Infinity;
    const forceRefresh = url.searchParams.get('refresh') === 'true' && cacheAge >= MIN_REFRESH_INTERVAL_MS;

    // 1. 有効なキャッシュがあれば即座に返却 (外部リクエストBAN防止)
    if (memoryCache && !forceRefresh && cacheAge < CACHE_TTL_MS) {
        return NextResponse.json(memoryCache.data, {
            headers: {
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
                'X-Cache': 'HIT',
            },
        });
    }

    try {
        if (!inflight) {
            inflight = fetchAllNews().finally(() => { inflight = null; });
        }
        const result = await inflight;

        // キャッシュの更新
        memoryCache = {
            data: result,
            timestamp: now,
        };

        return NextResponse.json(result, {
            headers: {
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
                'X-Cache': 'MISS',
            },
        });
    } catch (error) {
        console.error('API Error in /api/news:', error);

        if (memoryCache) {
            return NextResponse.json(memoryCache.data, {
                headers: { 'X-Cache': 'STALE-FALLBACK' },
            });
        }

        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
