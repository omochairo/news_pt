import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news-cache';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === 'true';
    const result = await getNews(refresh);

    if (!result) {
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
    // 取り直しの応答は CDN に置かない（後から押した人に、その時点の取り直し結果を使い回さないように）
    if (result.cache === 'STALE-FALLBACK' || refresh) {
        return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store', 'X-Cache': result.cache } });
    }
    return NextResponse.json(result.data, {
        headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
            'X-Cache': result.cache,
        },
    });
}
