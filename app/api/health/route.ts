import { NextResponse } from 'next/server';
import { MARKETS } from '@/lib/world-markets';
import { get24hLastFetch, getQuotes24h, getWorldLastFetch, getWorldQuotes } from '@/lib/world-markets-cache';
import { NEWS_SOURCES, getNews, getNewsEmptySince } from '@/lib/news-cache';
import { evaluateHealth } from '@/lib/health';

/**
 * 死活監視用。各取得元から実際に取れているかを返し、異常なら 503。
 * 定期ワークフロー（.github/workflows/health.yml）が本番に当てて、失敗通知で知る。
 * Netlify から叩くので、Yahoo 等に Netlify の送信元が遮断されたときにも気づける
 */
export async function GET() {
    // キャッシュが切れていれば、ここで外部へ取りに行く（通常の閲覧と同じキャッシュを通す）
    const [, , news] = await Promise.all([getWorldQuotes(), getQuotes24h(), getNews()]);

    const counts = news ? Object.fromEntries(NEWS_SOURCES.map(s => [s, news.data[s].length])) : {};
    const world = { lastFetch: getWorldLastFetch(), expected: MARKETS.length };
    const h24 = { lastFetch: get24hLastFetch(), expected: MARKETS.filter(m => m.h24).length };
    const emptySince = getNewsEmptySince();
    const report = evaluateHealth({ world, h24, news: news && { counts, stale: news.cache === 'STALE-FALLBACK', emptySince } });

    return NextResponse.json(
        { ...report, world, h24, news: news && { counts, emptySince, updatedAt: news.data.updatedAt, cache: news.cache } },
        { status: report.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    );
}
