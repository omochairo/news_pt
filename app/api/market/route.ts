import { NextResponse } from 'next/server';
import { toRelatedData, toTickerData } from '@/lib/market-data';
import { getWorldQuotes } from '@/lib/world-markets-cache';

// ニュース画面のティッカー（data）と、記事の下のチャート（related）。/api/world-markets と同じ取得・キャッシュから出す（外部への問い合わせを増やさない）
export async function GET() {
    const snapshot = await getWorldQuotes();
    if (!snapshot) {
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
    return NextResponse.json(
        { data: toTickerData(snapshot.quotes), related: toRelatedData(snapshot.quotes), updatedAt: snapshot.updatedAt },
        { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' } },
    );
}
