import { NextResponse } from 'next/server';
import { fetchBloombergNews, fetchReutersNews, fetchCNNNews } from '@/lib/parser';

export async function GET() {
    try {
        const [bloomberg, reuters, cnn] = await Promise.all([
            fetchBloombergNews(),
            fetchReutersNews(),
            fetchCNNNews(),
        ]);

        return NextResponse.json({
            bloomberg,
            reuters,
            cnn,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
    }
}
