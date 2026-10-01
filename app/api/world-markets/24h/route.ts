import { NextResponse } from 'next/server';
import { getQuotes24h } from '@/lib/world-markets-cache';

export async function GET() {
    const snapshot = await getQuotes24h();
    if (!snapshot) {
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
    return NextResponse.json(
        { quotes: Object.values(snapshot.quotes), updatedAt: snapshot.updatedAt },
        { headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' } },
    );
}
