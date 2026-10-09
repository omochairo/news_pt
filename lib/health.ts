import type { LastFetch } from './quote-cache';

/** 期待する件数のこの割合を下回ったら異常（一部の銘柄だけ一時的に欠けるのは許す） */
export const MIN_QUOTE_RATIO = 0.8;
/** 媒体の 0 件がこれ以上続いたら、前回の記事を表示していても異常（一時的な失敗は許す） */
export const MAX_NEWS_EMPTY_MS = 30 * 60 * 1000;

export interface HealthInput {
    world: { lastFetch: LastFetch | null; expected: number };
    h24: { lastFetch: LastFetch | null; expected: number };
    /**
     * 媒体ごとの件数。取得できず古いキャッシュを返したときは stale。
     * emptySince は 0 件が続いている媒体の、続き始めた時刻（その間は前回の記事を表示している）
     */
    news: { counts: Record<string, number>; stale: boolean; emptySince?: Record<string, string> } | null;
}

export interface HealthReport {
    ok: boolean;
    problems: string[];
}

function checkQuotes(name: string, { lastFetch, expected }: HealthInput['world']): string[] {
    if (!lastFetch) return [`${name}: 一度も取得していない`];
    const min = Math.ceil(expected * MIN_QUOTE_RATIO);
    return lastFetch.count < min ? [`${name}: 直近の取得が ${lastFetch.count}/${expected} 件（${min} 件未満）`] : [];
}

/** 相場は直近に外部から取れた件数、ニュースは媒体ごとに 1 件以上あるかで判定する */
export function evaluateHealth(input: HealthInput, now = Date.now()): HealthReport {
    const problems = [
        ...checkQuotes('world-markets', input.world),
        ...checkQuotes('world-markets/24h', input.h24),
    ];
    if (!input.news) {
        problems.push('news: 取得できない');
    } else {
        if (input.news.stale) problems.push('news: 取得に失敗し、古いキャッシュを返している');
        for (const [source, count] of Object.entries(input.news.counts)) {
            if (count === 0) problems.push(`news/${source}: 0 件`);
        }
        for (const [source, since] of Object.entries(input.news.emptySince ?? {})) {
            const minutes = Math.floor((now - Date.parse(since)) / 60_000);
            if (input.news.counts[source] > 0 && minutes * 60_000 >= MAX_NEWS_EMPTY_MS) {
                problems.push(`news/${source}: ${minutes} 分取れていない（前回の記事を表示中）`);
            }
        }
    }
    return { ok: problems.length === 0, problems };
}
