import { NextResponse } from 'next/server';
import { getNews } from '@/lib/news-cache';

export async function GET(request: Request) {
    const url = new URL(request.url);
    const result = await getNews(url.searchParams.get('refresh') === 'true');

    if (!result) {
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
    if (result.cache === 'STALE-FALLBACK') {
        return NextResponse.json(result.data, { headers: { 'X-Cache': result.cache } });
    }
    return NextResponse.json(result.data, {
        headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
            'X-Cache': result.cache,
        },
    });
}
