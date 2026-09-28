import { describe, expect, it } from 'vitest';
import { collectBySources, compareByDateDesc, countByCategory } from '../lib/feed';
import { parseDateInfo } from '../lib/parser';
import type { NewsItem } from '../lib/parser';

const item = (title: string, isoDate?: string, source: NewsItem['source'] = 'Nikkei'): NewsItem => ({
    title, url: `https://example.com/${encodeURIComponent(title)}`, source, time: '', isoDate,
});

describe('parseDateInfo', () => {
    const now = new Date('2026-09-28T03:00:00Z'); // JST 12:00

    it('読めない日付は取得時刻で埋めない', () => {
        expect(parseDateInfo(undefined, now)).toEqual({ time: '' });
        expect(parseDateInfo('not a date', now)).toEqual({ time: '' });
    });

    it('JST の当日は HH:MM、別の日は月日つき', () => {
        expect(parseDateInfo('2026-09-28T01:30:00Z', now)).toEqual({ time: '10:30', isoDate: '2026-09-28T01:30:00.000Z' });
        expect(parseDateInfo('2026-09-27T01:30:00Z', now).time).toBe('9/27 10:30');
    });
});

describe('compareByDateDesc', () => {
    it('新しい順で、日時不明は末尾', () => {
        const sorted = [item('a', '2026-09-27T00:00:00Z'), item('b'), item('c', '2026-09-28T00:00:00Z')].sort(compareByDateDesc);
        expect(sorted.map(i => i.title)).toEqual(['c', 'a', 'b']);
    });
});

describe('collectBySources / countByCategory', () => {
    const data = { nikkei: [item('日経の記事です')], crypto: [item('ビットコインが反発', undefined, 'Crypto')] };

    it('選んだ媒体だけ集める', () => {
        expect(collectBySources(data, new Set(['Crypto'])).map(i => i.source)).toEqual(['Crypto']);
        expect(collectBySources(null, new Set(['Crypto']))).toEqual([]);
    });

    it('カテゴリ件数を数える', () => {
        const counts = countByCategory(collectBySources(data, new Set(['Nikkei', 'Crypto'])));
        expect(counts.all).toBe(2);
        expect(counts.crypto).toBe(1);
    });
});
