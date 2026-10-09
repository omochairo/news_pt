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

    it('0 件になった媒体は前回の記事を残し、0 件が続き始めた時刻を記録する', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        fetchers.fetchCNNNews.mockResolvedValue([item('cnn-1')]);
        const { GET } = await loadRoute();
        const { getNewsEmptySince } = await import('../lib/news-cache');
        await GET(req());

        // 1 回目の失敗（例外）と 2 回目の失敗（空配列）。前回の記事を残し、時刻は最初の失敗のまま
        fetchers.fetchCNNNews.mockRejectedValue(new Error('down'));
        vi.setSystemTime(new Date('2026-10-01T00:06:00Z'));
        expect((await (await GET(req())).json()).cnn).toEqual([item('cnn-1')]);
        fetchers.fetchCNNNews.mockResolvedValue([]);
        vi.setSystemTime(new Date('2026-10-01T00:12:00Z'));
        expect((await (await GET(req())).json()).cnn).toEqual([item('cnn-1')]);
        expect(getNewsEmptySince()).toEqual({ cnn: '2026-10-01T00:06:00.000Z' });

        // 取れたら新しい記事に替わり、記録も消える
        fetchers.fetchCNNNews.mockResolvedValue([item('cnn-2')]);
        vi.setSystemTime(new Date('2026-10-01T00:18:00Z'));
        expect((await (await GET(req())).json()).cnn).toEqual([item('cnn-2')]);
        expect(getNewsEmptySince()).toEqual({});
    });

    it('?refresh=true の応答は CDN に置かない', async () => {
        const { GET } = await loadRoute();
        expect((await GET(req())).headers.get('Cache-Control')).toContain('s-maxage=300');
        expect((await GET(req('?refresh=true'))).headers.get('Cache-Control')).toBe('no-store');
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
