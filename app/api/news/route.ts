import { NextResponse } from 'next/server';
import {
    fetchBloombergNews,
    fetchReutersNews,
    fetchCNNNews,
    fetchNikkeiNews,
    fetchMinkabuFXNews,
    NewsItem,
} from '@/lib/parser';

interface CacheContainer {
    data: {
        nikkei: NewsItem[];
        minkabu: NewsItem[];
        bloomberg: NewsItem[];
        reuters: NewsItem[];
        cnn: NewsItem[];
        updatedAt: string;
    };
    timestamp: number;
}

// メモリ内キャッシュ (サーバーが起動している間保持)
let memoryCache: CacheContainer | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5分間キャッシュ

export async function GET(request: Request) {
    const now = Date.now();
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // 1. 有効なキャッシュがあれば即座に返却 (外部リクエストBAN防止)
    if (!forceRefresh && memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
        return NextResponse.json(memoryCache.data, {
            headers: {
                'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
                'X-Cache': 'HIT',
            },
        });
    }

    try {
        // 2. Promise.allSettled で一部が失敗しても全滅しないように取得
        const [nikkeiRes, minkabuRes, bloombergRes, reutersRes, cnnRes] = await Promise.allSettled([
            fetchNikkeiNews(),
            fetchMinkabuFXNews(),
            fetchBloombergNews(),
            fetchReutersNews(),
            fetchCNNNews(),
        ]);

        const result = {
            nikkei: nikkeiRes.status === 'fulfilled' ? nikkeiRes.value : [],
            minkabu: minkabuRes.status === 'fulfilled' ? minkabuRes.value : [],
            bloomberg: bloombergRes.status === 'fulfilled' ? bloombergRes.value : [],
            reuters: reutersRes.status === 'fulfilled' ? reutersRes.value : [],
            cnn: cnnRes.status === 'fulfilled' ? cnnRes.value : [],
            updatedAt: new Date().toISOString(),
        };

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

        // エラーが発生した場合でも古いキャッシュがあればそれを返す
        if (memoryCache) {
            return NextResponse.json(memoryCache.data, {
                headers: { 'X-Cache': 'STALE-FALLBACK' },
            });
        }

        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
