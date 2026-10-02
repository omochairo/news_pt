import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsItem } from '../lib/parser';

const fetchers = {
    fetchNikkeiNews: vi.fn(),
    fetchMinkabuFXNews: vi.fn(),
    fetchBloombergNews: vi.fn(),
    fetchReutersNews: vi.fn(),
    fetchCNNNews: vi.fn(),
    fetchCryptoNews: vi.fn(),
};
vi.mock('../lib/parser', () => fetchers);

const item = (url: string): NewsItem => ({ title: url, url, source: 'Reuters', time: '' });
type Route = { GET: (req: Request) => Promise<Response> };

async function loadRoute(): Promise<Route> {
    vi.resetModules();
    return import('../app/api/news/route');
}
const req = (q = '') => new Request(`http://localhost/api/news${q}`);

beforeEach(() => {
    Object.values(fetchers).forEach(f => f.mockReset().mockResolvedValue([item('x')]));
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('/api/news', () => {
    it('6 媒体を取り、5 分はキャッシュ（X-Cache: HIT）を返す', async () => {
        const { GET } = await loadRoute();
        const first = await GET(req());
        expect(first.headers.get('X-Cache')).toBe('MISS');
        const body = await first.json();
        expect(Object.keys(body).sort()).toEqual(['bloomberg', 'cnn', 'crypto', 'minkabu', 'nikkei', 'reuters', 'updatedAt']);
        const second = await GET(req());
        expect(second.headers.get('X-Cache')).toBe('HIT');
        expect(fetchers.fetchNikkeiNews).toHaveBeenCalledTimes(1);
    });

    it('1 媒体が失敗しても、その媒体を空にして残りを返す', async () => {
        fetchers.fetchCNNNews.mockRejectedValue(new Error('down'));
        const { GET } = await loadRoute();
        const body = await (await GET(req())).json();
        expect(body.cnn).toEqual([]);
        expect(body.reuters).toHaveLength(1);
    });

    it('?refresh=true はキャッシュが 1 分より古いときだけ取り直す', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        const { GET } = await loadRoute();
        await GET(req());
        await GET(req('?refresh=true'));
        expect(fetchers.fetchNikkeiNews).toHaveBeenCalledTimes(1);
        vi.setSystemTime(new Date('2026-10-01T00:01:30Z'));
        const res = await GET(req('?refresh=true'));
        expect(res.headers.get('X-Cache')).toBe('MISS');
        expect(fetchers.fetchNikkeiNews).toHaveBeenCalledTimes(2);
    });

    it('取得そのものが例外になったら、古いキャッシュか 500', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        // Promise.allSettled の外で落ちる場合（同期的に例外）を再現する
        fetchers.fetchNikkeiNews.mockImplementation(() => { throw new Error('sync'); });
        const { GET } = await loadRoute();
        expect((await GET(req())).status).toBe(500);

        fetchers.fetchNikkeiNews.mockResolvedValue([item('a')]);
        await GET(req());
        vi.setSystemTime(new Date('2026-10-01T00:06:00Z'));
        fetchers.fetchNikkeiNews.mockImplementation(() => { throw new Error('sync'); });
        const stale = await GET(req());
        expect(stale.status).toBe(200);
        expect(stale.headers.get('X-Cache')).toBe('STALE-FALLBACK');
        expect((await stale.json()).nikkei).toEqual([item('a')]);
    });
});
