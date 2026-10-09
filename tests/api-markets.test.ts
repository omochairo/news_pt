import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MARKETS } from '../lib/world-markets';
import { SOURCES } from '../lib/sources';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';

const get = vi.mocked(axios.get);
const H24 = MARKETS.filter(m => m.h24).map(m => m.symbol);

/** spark API の応答を、要求された銘柄ごとに作る。blocked に入れた銘柄は応答に含めない */
function sparkFor(url: string, blocked = new Set<string>()) {
    const u = new URL(url);
    const symbols = (u.searchParams.get('symbols') ?? '').split(',').map(decodeURIComponent);
    const t0 = 1790000000;
    const n = 100;
    const timestamp = Array.from({ length: n }, (_, i) => t0 + i * 900);
    return Object.fromEntries(symbols.filter(s => !blocked.has(s)).map(s => [s, {
        timestamp,
        close: timestamp.map((_, i) => 100 + i),
        previousClose: 100,
        start: t0,
        end: t0 + n * 900,
    }]));
}

// 日本国債 10 年（財務省 CSV）の当月分。10 年は 11 列目
const MOF_CSV = ['見出し', '基準日', 'R8.10.1,1,1,1,1,1,1,1,1,1,3.092', 'R8.10.2,1,1,1,1,1,1,1,1,1,3.104'].join('\r\n');

function serveSpark(blocked = new Set<string>()) {
    get.mockImplementation(async (url: string) => ({ data: url.includes('mof.go.jp') ? MOF_CSV : sparkFor(url, blocked) }));
}

/** Yahoo の spark への問い合わせ回数（財務省の CSV は数えない） */
const sparkCalls = () => get.mock.calls.filter(([u]) => String(u).includes('/spark?')).length;
const YAHOO_COUNT = MARKETS.filter(m => !m.source).length;

/** ルートはモジュール内にキャッシュを持つので、テストごとに読み直す */
async function load<T>(path: string): Promise<T> {
    vi.resetModules();
    return import(path) as Promise<T>;
}

type Route = { GET: (req?: NextRequest) => Promise<Response> };

beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe('/api/world-markets', () => {
    it('53 銘柄を 20 銘柄ずつの spark で取り、1 分はキャッシュを返す', async () => {
        serveSpark();
        const { GET } = await load<Route>('../app/api/world-markets/route');
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.quotes).toHaveLength(MARKETS.length);
        expect(body.quotes.find((q: { symbol: string }) => q.symbol === 'JGB10Y')).toMatchObject({ price: 3.104, previousClose: 3.092 });
        expect(sparkCalls()).toBe(Math.ceil(YAHOO_COUNT / 20));
        expect(res.headers.get('Cache-Control')).toContain('s-maxage=60');
        await GET();
        expect(sparkCalls()).toBe(Math.ceil(YAHOO_COUNT / 20));
    });

    it('同時に来たリクエストは 1 回の取得にまとめる', async () => {
        serveSpark();
        const { GET } = await load<Route>('../app/api/world-markets/route');
        await Promise.all([GET(), GET(), GET()]);
        expect(sparkCalls()).toBe(Math.ceil(YAHOO_COUNT / 20));
    });

    it('1 バッチが落ちても残りを返し、取れなかった銘柄は前回値を残す', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        serveSpark();
        const { GET } = await load<Route>('../app/api/world-markets/route');
        await GET();
        // 1 分後、最初のバッチだけ失敗させる
        vi.setSystemTime(new Date('2026-10-01T00:01:01Z'));
        let call = 0;
        get.mockImplementation(async (url: string) => {
            if (url.includes('mof.go.jp')) return { data: MOF_CSV };
            if (call++ === 0) throw new Error('timeout');
            return { data: sparkFor(url) };
        });
        const body = await (await GET()).json();
        expect(body.quotes).toHaveLength(MARKETS.length);
        expect(console.error).toHaveBeenCalled();
    });

    it('初回から全滅しても落ちず、空の一覧を返す', async () => {
        get.mockRejectedValue(new Error('blocked'));
        const { GET } = await load<Route>('../app/api/world-markets/route');
        // 初回が全滅しても空のスナップショットとして 200
        const first = await GET();
        expect(first.status).toBe(200);
        expect((await first.json()).quotes).toEqual([]);
    });
});

describe('/api/world-markets/24h', () => {
    it('24 時間対象の銘柄だけを 5 日分の 15 分足で取る', async () => {
        serveSpark();
        const { GET } = await load<Route>('../app/api/world-markets/24h/route');
        const body = await (await GET()).json();
        expect(body.quotes.map((q: { symbol: string }) => q.symbol).sort()).toEqual([...H24].sort());
        expect(get.mock.calls[0][0]).toContain('range=5d&interval=15m');
    });
});

describe('/api/market（ティッカー）', () => {
    it('world-markets の取得を共有し、9 銘柄を整形して返す', async () => {
        serveSpark();
        const market = await load<Route>('../app/api/market/route');
        const world = await import('../app/api/world-markets/route');
        const body = await (await market.GET()).json();
        expect(body.data).toHaveLength(9);
        expect(body.data.every((d: { price: string }) => d.price !== '--')).toBe(true);
        const calls = get.mock.calls.length;
        await world.GET();
        expect(get.mock.calls.length).toBe(calls); // 同じキャッシュを使う
    });
});

describe('/api/world-markets/history', () => {
    const req = (q: string) => new NextRequest(`http://localhost/api/world-markets/history?${q}`);

    it('知らない銘柄・期間は 400 で、外部へ取りに行かない', async () => {
        const { GET } = await load<Route>('../app/api/world-markets/history/route');
        expect((await GET(req('symbol=AAPL&range=5d'))).status).toBe(400);
        expect((await GET(req('symbol=%5EN225&range=10y'))).status).toBe(400);
        expect((await GET(req(''))).status).toBe(400);
        expect(get).not.toHaveBeenCalled();
    });

    it('期間ごとの足で取り、銘柄×期間でキャッシュする', async () => {
        serveSpark();
        const { GET } = await load<Route>('../app/api/world-markets/history/route');
        const res = await GET(req('symbol=%5EN225&range=1y'));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body).toMatchObject({ symbol: '^N225', range: '1y', first: 100, last: 199 });
        expect(get.mock.calls[0][0]).toContain('range=1y&interval=1d');
        await GET(req('symbol=%5EN225&range=1y'));
        expect(get).toHaveBeenCalledTimes(1);
        await GET(req('symbol=%5EN225&range=5d'));
        expect(get).toHaveBeenCalledTimes(2);
        expect(get.mock.calls[1][0]).toContain('range=5d&interval=30m');
    });

    it('取れなければ 502、期限切れのキャッシュがあればそれを返す', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        get.mockRejectedValueOnce(new Error('blocked'));
        const { GET } = await load<Route>('../app/api/world-markets/history/route');
        expect((await GET(req('symbol=JPY%3DX&range=5d'))).status).toBe(502);

        serveSpark();
        expect((await GET(req('symbol=JPY%3DX&range=5d'))).status).toBe(200);
        vi.setSystemTime(new Date('2026-10-01T00:06:00Z')); // 5 日の TTL（5 分）切れ
        get.mockRejectedValueOnce(new Error('blocked'));
        const stale = await GET(req('symbol=JPY%3DX&range=5d'));
        expect(stale.status).toBe(200);
        expect((await stale.json()).symbol).toBe('JPY=X');
    });

    it('足が足りない応答は 502', async () => {
        get.mockResolvedValue({ data: {} });
        const { GET } = await load<Route>('../app/api/world-markets/history/route');
        expect((await GET(req('symbol=JPY%3DX&range=1mo'))).status).toBe(502);
    });
});

describe('/api/health', () => {
    async function loadHealth(news: Record<string, number>) {
        vi.resetModules();
        vi.doMock('../lib/news-cache', async importOriginal => ({
            ...(await importOriginal<typeof import('../lib/news-cache')>()),
            getNews: async () => ({
                data: { ...Object.fromEntries(Object.entries(news).map(([k, v]) => [k, Array(v).fill({})])), updatedAt: 'x' },
                cache: 'HIT',
            }),
        }));
        return import('../app/api/health/route');
    }
    const allNews = Object.fromEntries(SOURCES.map(s => [s.key, 3]));

    it('すべて取れていれば 200', async () => {
        serveSpark();
        const { GET } = await loadHealth(allNews);
        const res = await GET();
        expect(res.status).toBe(200);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect((await res.json()).ok).toBe(true);
    });

    it('監視対象外の媒体（東洋経済）は 0 件でも異常にしないが、件数は応答に出す', async () => {
        serveSpark();
        const { GET } = await loadHealth({ ...allNews, toyokeizai: 0 });
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.news.counts.toyokeizai).toBe(0);
    });

    it('相場の取得が 8 割を切る・ニュースの媒体が 0 件なら 503 と原因を返す', async () => {
        // 24 時間対象の銘柄を全部落とす
        serveSpark(new Set(H24));
        const { GET } = await loadHealth({ ...allNews, cnn: 0 });
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(503);
        expect(body.problems).toEqual([
            `world-markets: 直近の取得が ${MARKETS.length - H24.length}/${MARKETS.length} 件（${Math.ceil(MARKETS.length * 0.8)} 件未満）`,
            `world-markets/24h: 直近の取得が 0/${H24.length} 件（${Math.ceil(H24.length * 0.8)} 件未満）`,
            'news/cnn: 0 件',
        ]);
    });
});
