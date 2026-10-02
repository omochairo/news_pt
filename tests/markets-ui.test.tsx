// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import WorldMarketsBoard from '../components/WorldMarketsBoard';
import MarketTile from '../components/MarketTile';
import Markets24hView from '../components/Markets24hView';
import { MARKETS, Quote24h, QuoteHistory, WorldQuote } from '../lib/world-markets';
import { FAVORITES_STORAGE_KEY } from '../lib/favorites';

const NOW = new Date('2026-10-01T03:00:00Z');

function worldQuote(symbol: string, changePercent = 1): WorldQuote {
    return {
        symbol,
        price: 100 + changePercent,
        previousClose: 100,
        change: changePercent,
        changePercent,
        history: [100, 100 + changePercent],
        lastTradeAt: new Date(NOW.getTime() - 60_000).toISOString(),
        sessionStart: new Date(NOW.getTime() - 3_600_000).toISOString(),
        sessionEnd: new Date(NOW.getTime() + 3_600_000).toISOString(),
    };
}

function quote24h(symbol: string, changePercent: number, to = NOW): Quote24h {
    return {
        symbol, price: 100 + changePercent, base: 100, change: changePercent, changePercent,
        high: 101, low: 99, rangePercent: 2, history: [100, 101], from: new Date(to.getTime() - 86_400_000).toISOString(), to: to.toISOString(),
    };
}

function history(symbol: string, range: string, change = 5): QuoteHistory {
    return {
        symbol, range: range as QuoteHistory['range'],
        points: [{ t: '2026-09-25T00:00:00.000Z', v: 100 }, { t: '2026-10-01T00:00:00.000Z', v: 100 + change }],
        first: 100, last: 100 + change, change, changePercent: change, high: 106, low: 99,
    };
}

type Handler = (url: string) => unknown | Promise<unknown>;
let routes: Record<string, Handler>;
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes).find(k => url.startsWith(k));
    if (!key) return new Response('not found', { status: 404 });
    const body = await routes[key](url);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200 });
});

beforeAll(() => {
    // jsdom は <dialog> のモーダル表示を持たないので最小限を足す
    if (!HTMLDialogElement.prototype.showModal) {
        HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
        HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
            if (!this.hasAttribute('open')) return;
            this.removeAttribute('open');
            this.dispatchEvent(new Event('close'));
        };
    }
});

beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    localStorage.clear();
    routes = {
        '/api/world-markets/24h': () => ({ quotes: MARKETS.filter(m => m.h24).map((m, i) => quote24h(m.symbol, i % 2 ? -i : i)), updatedAt: NOW.toISOString() }),
        '/api/world-markets/history': url => {
            const u = new URL(url, 'http://x');
            return history(u.searchParams.get('symbol')!, u.searchParams.get('range')!);
        },
        '/api/world-markets': () => ({ quotes: MARKETS.map(m => worldQuote(m.symbol)), updatedAt: NOW.toISOString() }),
        '/api/news': () => ({
            nikkei: [{ title: '外為14時　円相場、軟調', url: 'https://n/1', source: 'Nikkei', time: '14:09', isoDate: '2026-10-01T05:09:00Z' }],
            reuters: [{ title: '新製品を発表しました', url: 'https://r/1', source: 'Reuters', time: '13:00', isoDate: '2026-10-01T04:00:00Z' }],
            updatedAt: NOW.toISOString(),
        }),
    };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const tile = (name: string) => screen.getAllByRole('button', { name: `${name}の詳細チャートを開く` })[0];

describe('MarketTile', () => {
    const def = MARKETS.find(m => m.symbol === 'JPY=X')!;

    it('値が無ければ「取得できませんでした」、押せない', () => {
        render(<MarketTile def={def} now={NOW} />);
        expect(screen.getByText('取得できませんでした')).toBeTruthy();
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('下落は赤、横 8 つ表示では前日比と注記を出さない', () => {
        const { container } = render(<MarketTile def={{ ...def, note: '注記' }} quote={worldQuote('JPY=X', -1)} now={NOW} dense />);
        expect(screen.getByText('-1.00%').className).toContain('text-red-400');
        expect(container.textContent).not.toContain('注記');
    });

    it('Enter / Space で開き、他のキーや中の ☆ では開かない', () => {
        const onOpen = vi.fn();
        const onToggle = vi.fn();
        render(<MarketTile def={def} quote={worldQuote('JPY=X')} now={NOW} onOpen={onOpen} onToggleFavorite={onToggle} />);
        const el = screen.getByRole('button', { name: 'ドル円の詳細チャートを開く' });
        fireEvent.keyDown(el, { key: 'Enter' });
        fireEvent.keyDown(el, { key: ' ' });
        fireEvent.keyDown(el, { key: 'a' });
        expect(onOpen).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole('button', { name: 'ドル円をお気に入りに追加' }));
        expect(onToggle).toHaveBeenCalledWith('JPY=X');
        expect(onOpen).toHaveBeenCalledTimes(2);
    });
});

describe('WorldMarketsBoard', () => {
    it('全銘柄を地域ごとに出し、地域タブで絞る', async () => {
        render(<WorldMarketsBoard />);
        expect(screen.getByText('読み込み中...')).toBeTruthy();
        await screen.findByRole('heading', { name: /米国/ });
        expect(screen.getAllByRole('button', { name: /の詳細チャートを開く$/ })).toHaveLength(MARKETS.length);
        fireEvent.click(screen.getByRole('button', { name: '日本' }));
        expect(screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)).toEqual([expect.stringContaining('日本')]);
    });

    it('☆ でお気に入りが「すべて」の先頭に出て、保存される', async () => {
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(screen.getByRole('button', { name: 'ドル円をお気に入りに追加' }));
        expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).toContain('お気に入り');
        expect(JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY)!)).toEqual(['JPY=X']);
        fireEvent.click(screen.getAllByRole('button', { name: 'ドル円をお気に入りから外す' })[0]);
        expect(screen.getAllByRole('heading', { level: 2 })[0].textContent).not.toContain('お気に入り');
    });

    it('表示サイズの切り替えを保存し、次に開いたときも使う', async () => {
        const { unmount } = render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(screen.getByRole('button', { name: '横8つ' }));
        expect(localStorage.getItem('vantage-point-markets-layout')).toBe('dense');
        unmount();
        render(<WorldMarketsBoard />);
        await waitFor(() => expect(screen.getByRole('button', { name: '横8つ' }).getAttribute('aria-pressed')).toBe('true'));
    });

    it('取得に失敗したら前回の値を残して知らせる', async () => {
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        routes['/api/world-markets'] = () => new Response('', { status: 500 });
        // 裏に回して戻すと取り直す
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
        await screen.findByText('更新に失敗しました（前回の値を表示中）');
        expect(screen.getAllByRole('button', { name: /の詳細チャートを開く$/ })).toHaveLength(MARKETS.length);
    });

    it('24時間タブではグリッドの取得を止め、24 時間ビューを出す', async () => {
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(screen.getByRole('button', { name: '24時間' }));
        await screen.findByText('24時間の値動き');
        expect(screen.queryByText('LAST SYNC (JST)')).toBeNull();
    });

    it('タイルを押すと詳細が開き、期間の切り替え・関連ニュース・閉じるができる', async () => {
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(tile('ドル円'));
        const dialog = await screen.findByRole('dialog', { hidden: true });
        await within(dialog).findByText(/5日で \+5\.00%/);
        expect(within(dialog).getByText('始値')).toBeTruthy();
        fireEvent.click(within(dialog).getByRole('button', { name: '1年', hidden: true }));
        await within(dialog).findByText(/1年で/);
        expect(fetchMock.mock.calls.some(([u]) => String(u).includes('range=1y'))).toBe(true);
        // 関連ニュース: 円相場の記事だけ
        const link = await within(dialog).findByRole('link', { hidden: true });
        expect(link.getAttribute('href')).toBe('https://n/1');
        expect(link.getAttribute('target')).toBe('_blank');
        fireEvent.click(within(dialog).getByRole('button', { name: '閉じる', hidden: true }));
        expect(dialog.hasAttribute('open')).toBe(false);
    });

    it('詳細の取得に失敗したら「再読み込み」で取り直す', async () => {
        let fail = true;
        const ok = routes['/api/world-markets/history'];
        routes['/api/world-markets/history'] = url => (fail ? new Response('', { status: 502 }) : ok(url));
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(tile('日経平均'));
        const dialog = await screen.findByRole('dialog', { hidden: true });
        await within(dialog).findByText('取得できませんでした');
        fail = false;
        fireEvent.click(within(dialog).getByRole('button', { name: '再読み込み', hidden: true }));
        await within(dialog).findByText(/5日で/);
    });

    it('関連ニュースの対応が無い銘柄では欄を出さず、ニュースが取れなければその旨を出す', async () => {
        routes['/api/news'] = () => new Response('', { status: 500 });
        // 前のテストで取ったニュースのキャッシュ（5 分）を切らす
        vi.setSystemTime(new Date(NOW.getTime() + 6 * 60_000));
        render(<WorldMarketsBoard />);
        await screen.findByRole('heading', { name: /米国/ });
        fireEvent.click(tile('FANG+'));
        let dialog = await screen.findByRole('dialog', { hidden: true });
        await within(dialog).findByText(/5日で/);
        expect(within(dialog).queryByText('関連ニュース')).toBeNull();
        fireEvent.click(within(dialog).getByRole('button', { name: '閉じる', hidden: true }));
        fireEvent.click(tile('原油 WTI'));
        dialog = await screen.findByRole('dialog', { hidden: true });
        await within(dialog).findByText('ニュースを取得できませんでした');
    });
});

describe('Markets24hView', () => {
    it('標準の並びと変動の大きい順を切り替え、止まった銘柄に「停止中」を出す', async () => {
        const h24 = MARKETS.filter(m => m.h24);
        routes['/api/world-markets/24h'] = () => ({
            quotes: [
                quote24h(h24[0].symbol, 0.5),
                quote24h(h24[1].symbol, -3),
                quote24h(h24[2].symbol, 1, new Date(NOW.getTime() - 2 * 3_600_000)),
                quote24h('UNKNOWN', 9),
            ],
            updatedAt: NOW.toISOString(),
        });
        const { container } = render(<Markets24hView />);
        await screen.findByText('24時間の値動き');
        const names = () => [...container.querySelectorAll('span.font-bold.truncate')].map(e => e.textContent);
        expect(names()).toEqual([h24[0].name, h24[1].name, h24[2].name]);
        fireEvent.click(screen.getByRole('button', { name: '変動の大きい順' }));
        expect(names()).toEqual([h24[1].name, h24[2].name, h24[0].name]);
        expect(screen.getByText(/停止中/)).toBeTruthy();
    });

    it('取得に失敗したら知らせる', async () => {
        routes['/api/world-markets/24h'] = () => new Response('', { status: 500 });
        render(<Markets24hView />);
        await screen.findByText('更新に失敗しました（前回の値を表示中）');
    });
});
