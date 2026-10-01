import type { LastFetch } from './quote-cache';

/** 期待する件数のこの割合を下回ったら異常（一部の銘柄だけ一時的に欠けるのは許す） */
export const MIN_QUOTE_RATIO = 0.8;

export interface HealthInput {
    world: { lastFetch: LastFetch | null; expected: number };
    h24: { lastFetch: LastFetch | null; expected: number };
    /** 媒体ごとの件数。取得できず古いキャッシュを返したときは stale */
    news: { counts: Record<string, number>; stale: boolean } | null;
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
export function evaluateHealth(input: HealthInput): HealthReport {
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
    }
    return { ok: problems.length === 0, problems };
}
