import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsItem } from '../lib/parser';

const fetchers = {
    fetchNikkeiNews: vi.fn(),
    fetchMinkabuFXNews: vi.fn(),
    fetchBloombergNews: vi.fn(),
    fetchReutersNews: vi.fn(),
    fetchCNNNews: vi.fn(),
    fetchCryptoNews: vi.fn(),
    fetchBOJNews: vi.fn(),
    fetchKabutanNews: vi.fn(),
    fetchTradersWebNews: vi.fn(),
    fetchZaiFXNews: vi.fn(),
    fetchToyoKeizaiNews: vi.fn(),
    fetchDiamondNews: vi.fn(),
};
vi.mock('../lib/parser', () => fetchers);

const item: NewsItem = { title: 'x', url: 'https://x/', source: 'Reuters', time: '' };

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
    Object.values(fetchers).forEach(f => f.mockReset().mockResolvedValue([item]));
});
afterEach(() => vi.useRealTimers());

describe('news-cache: キャッシュの時刻', () => {
    it('取得に TTL より長くかかっても、取得完了の直後は HIT になる', async () => {
        vi.resetModules();
        const { getNews } = await import('../lib/news-cache');
        fetchers.fetchNikkeiNews.mockImplementation(async () => {
            vi.setSystemTime(Date.now() + 6 * 60 * 1000); // 取得に 6 分かかった
            return [item];
        });
        expect((await getNews())?.cache).toBe('MISS');
        expect((await getNews())?.cache).toBe('HIT');
    });
});
