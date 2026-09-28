import type { NewsItem, NewsSource } from './parser';
import { categorizeArticle, type NewsCategory } from './categorizer';

/** /api/news のレスポンス（媒体ごとの記事配列） */
export interface FeedData {
    nikkei?: NewsItem[];
    minkabu?: NewsItem[];
    bloomberg?: NewsItem[];
    reuters?: NewsItem[];
    cnn?: NewsItem[];
    crypto?: NewsItem[];
}

const SOURCE_KEYS: [NewsSource, keyof FeedData][] = [
    ['Nikkei', 'nikkei'],
    ['MinkabuFX', 'minkabu'],
    ['Crypto', 'crypto'],
    ['Bloomberg', 'bloomberg'],
    ['Reuters', 'reuters'],
    ['CNN', 'cnn'],
];

/** 選択中の媒体の記事をまとめて返す */
export function collectBySources(data: FeedData | null, sources: Set<NewsSource>): NewsItem[] {
    if (!data) return [];
    const items: NewsItem[] = [];
    for (const [source, key] of SOURCE_KEYS) {
        if (sources.has(source)) items.push(...(data[key] || []));
    }
    return items;
}

function toEpoch(item: NewsItem): number {
    const t = item.isoDate ? new Date(item.isoDate).getTime() : NaN;
    return Number.isNaN(t) ? -Infinity : t;
}

/** 新しい順。配信日時が分からない記事は末尾に回す */
export function compareByDateDesc(a: NewsItem, b: NewsItem): number {
    const ta = toEpoch(a);
    const tb = toEpoch(b);
    if (ta === tb) return 0;
    return tb > ta ? 1 : -1;
}

/** カテゴリタブに出す件数 */
export function countByCategory(items: NewsItem[]): Record<NewsCategory, number> {
    const counts: Record<NewsCategory, number> = {
        all: items.length, fx: 0, stocks: 0, bonds: 0, commodities: 0, crypto: 0, economy: 0,
    };
    for (const item of items) {
        const cat = categorizeArticle(item.title);
        if (cat !== 'all') counts[cat]++;
    }
    return counts;
}
