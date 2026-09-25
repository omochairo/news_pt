import { NextResponse } from 'next/server';
import { ECONOMIC_EVENTS, EconomicEvent, EventSource, getUpcomingEvents, toJstDate } from '@/lib/economic-calendar';
import { fetchBojEvents, fetchEcbEvents, fetchFomcEvents } from '@/lib/calendar-fetch';

// 日程はめったに変わらないので、公式ページへの問い合わせは12時間に1回
let memoryCache: { events: EconomicEvent[]; sources: Record<string, 'live' | 'static'>; timestamp: number } | null = null;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const HORIZON_MS = 183 * 24 * 60 * 60 * 1000;

const FETCHERS: Partial<Record<EventSource, () => Promise<EconomicEvent[]>>> = {
    fomc: fetchFomcEvents,
    ecb: fetchEcbEvents,
    boj: fetchBojEvents,
};

async function buildEvents() {
    const entries = Object.entries(FETCHERS) as [EventSource, () => Promise<EconomicEvent[]>][];
    const results = await Promise.allSettled(entries.map(([, fetcher]) => fetcher()));

    const events: EconomicEvent[] = [];
    const sources: Record<string, 'live' | 'static'> = { bls: 'static' };
    const now = new Date();

    entries.forEach(([source], i) => {
        const r = results[i];
        // 取得に失敗した・今後の予定が1件も取れなかった取得元は、手動の予定表で補う
        const live = r.status === 'fulfilled' ? getUpcomingEvents(r.value, now) : [];
        if (live.length > 0) {
            events.push(...live);
            sources[source] = 'live';
        } else {
            if (r.status === 'rejected') console.error(`Calendar fetch failed for ${source}:`, r.reason?.message ?? r.reason);
            events.push(...ECONOMIC_EVENTS.filter(e => e.source === source));
            sources[source] = 'static';
        }
    });
    events.push(...ECONOMIC_EVENTS.filter(e => e.source === 'bls'));

    // 公式ページには1〜2年先まで載っているので、表示は向こう半年に絞る
    const horizon = now.getTime() + HORIZON_MS;
    const upcoming = getUpcomingEvents(events, now).filter(e => toJstDate(e.date, e.time).getTime() <= horizon);
    return { events: upcoming, sources };
}

export async function GET() {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.timestamp >= CACHE_TTL_MS) {
        try {
            memoryCache = { ...(await buildEvents()), timestamp: now };
        } catch (error) {
            console.error('Calendar API Error:', error);
            if (!memoryCache) {
                return NextResponse.json({ events: getUpcomingEvents(), sources: {} });
            }
        }
    }
    return NextResponse.json(
        { events: memoryCache.events, sources: memoryCache.sources, updatedAt: new Date(memoryCache.timestamp).toISOString() },
        { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400' } },
    );
}
