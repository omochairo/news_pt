// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveAlertsToggle, MoveAlertsWatcher } from '../components/MoveAlerts';
import MarketTicker from '../components/MarketTicker';
import Sparkline from '../components/Sparkline';
import { MarketDataProvider } from '../lib/market-context';
import { ALERTS_ENABLED_KEY, ALERTS_STATE_KEY } from '../lib/move-alerts';
import type { SymbolMarketData } from '../lib/market-data';

const NOW = new Date('2026-10-01T03:00:00Z');

/** ブラウザの Notification の代わり。表示された通知を記録する */
function installNotification(permission: NotificationPermission, grant: NotificationPermission = 'granted') {
    const shown: { title: string; options?: NotificationOptions; instance: { onclick: null | (() => void); close: () => void } }[] = [];
    class FakeNotification {
        static permission = permission;
        static requestPermission = vi.fn(async () => { FakeNotification.permission = grant; return grant; });
        onclick: null | (() => void) = null;
        close = vi.fn();
        constructor(title: string, options?: NotificationOptions) { shown.push({ title, options, instance: this }); }
    }
    vi.stubGlobal('Notification', FakeNotification);
    return { shown, FakeNotification };
}

function move24h(changePercent: number, to = NOW) {
    return {
        quotes: [
            { symbol: 'JPY=X', price: 162, base: 158, change: 4, changePercent, high: 0, low: 0, rangePercent: 0, history: [], from: to.toISOString(), to: to.toISOString() },
            { symbol: '^N225', price: 1, base: 1, change: 0, changePercent: 9, high: 0, low: 0, rangePercent: 0, history: [], from: NOW.toISOString(), to: NOW.toISOString() },
        ],
    };
}

let respond: (url: string) => Response;
const fetchMock = vi.fn(async (input: RequestInfo | URL) => respond(String(input)));
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MoveAlertsToggle', () => {
    it('通知に未対応のブラウザでは出さない', () => {
        vi.stubGlobal('Notification', undefined);
        // 'Notification' in window を false にする
        delete (window as { Notification?: unknown }).Notification;
        const { container } = render(<MoveAlertsToggle />);
        expect(container.innerHTML).toBe('');
    });

    it('ブロックされていればその旨を出す', async () => {
        installNotification('denied');
        render(<MoveAlertsToggle />);
        await screen.findByText('通知はブラウザの設定でブロックされています');
    });

    it('押すと許可を求めてオンにし、もう一度押すとオフ', async () => {
        const { FakeNotification } = installNotification('default');
        render(<MoveAlertsToggle />);
        fireEvent.click(await screen.findByRole('button', { name: '変動通知 オフ' }));
        await screen.findByRole('button', { name: '変動通知 オン' });
        expect(FakeNotification.requestPermission).toHaveBeenCalled();
        expect(localStorage.getItem(ALERTS_ENABLED_KEY)).toBe('on');
        fireEvent.click(screen.getByRole('button', { name: '変動通知 オン' }));
        await screen.findByRole('button', { name: '変動通知 オフ' });
        expect(localStorage.getItem(ALERTS_ENABLED_KEY)).toBeNull();
    });

    it('許可されなければオンにならない', async () => {
        installNotification('default', 'denied');
        render(<MoveAlertsToggle />);
        fireEvent.click(await screen.findByRole('button', { name: '変動通知 オフ' }));
        await screen.findByText('通知はブラウザの設定でブロックされています');
        expect(localStorage.getItem(ALERTS_ENABLED_KEY)).toBeNull();
    });

    it('別のタブで切り替えたら追従する', async () => {
        installNotification('granted');
        render(<MoveAlertsToggle />);
        await screen.findByRole('button', { name: '変動通知 オフ' });
        localStorage.setItem(ALERTS_ENABLED_KEY, 'on');
        act(() => { window.dispatchEvent(new StorageEvent('storage', { key: ALERTS_ENABLED_KEY })); });
        await screen.findByRole('button', { name: '変動通知 オン' });
    });
});

describe('MoveAlertsWatcher', () => {
    // setInterval を偽物にするので、Testing Library の waitFor（内部で setInterval を使う）は使えない。
    // 本物の setTimeout で少し待って、取得と通知の非同期処理を終わらせる
    const settle = () => act(() => new Promise(r => setTimeout(r, 50)));

    beforeEach(() => {
        vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] });
    });

    it('オフの間は何も取りに行かない', async () => {
        installNotification('granted');
        render(<MoveAlertsWatcher />);
        await act(async () => { vi.advanceTimersByTime(120_000); });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('オンなら 1 分ごとに確認し、しきい値・1% 刻みで通知し、止まった銘柄は判定しない', async () => {
        const { shown } = installNotification('granted');
        localStorage.setItem(ALERTS_ENABLED_KEY, 'on');
        let pct = 2.5;
        respond = () => json(move24h(pct));
        render(<MoveAlertsWatcher />);
        await settle();
        expect(shown).toHaveLength(1);
        expect(shown[0].title).toBe('ドル円 +2.50%（24時間）');
        expect(shown[0].options).toMatchObject({ body: '現在値 162.000（24時間前 158.000）', tag: 'move-JPY=X' });
        // 押すとタブを前に出して閉じる
        const focus = vi.spyOn(window, 'focus').mockImplementation(() => {});
        shown[0].instance.onclick?.();
        expect(focus).toHaveBeenCalled();

        pct = 3.2;
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await settle();
        expect(shown).toHaveLength(2);
        expect(JSON.parse(localStorage.getItem(ALERTS_STATE_KEY)!)).toEqual({ 'JPY=X': 3 });

        // 最後の足が 2 時間前（停止中）なら、反転していても鳴らさない
        respond = () => json(move24h(-5, new Date(NOW.getTime() - 2 * 3_600_000)));
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await settle();
        expect(shown).toHaveLength(2);
    });

    it('Service Worker が登録されていればそちらで通知する', async () => {
        installNotification('granted');
        localStorage.setItem(ALERTS_ENABLED_KEY, 'on');
        respond = () => json(move24h(-2.2));
        const showNotification = vi.fn(async () => {});
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { getRegistration: async () => ({ showNotification }) },
        });
        render(<MoveAlertsWatcher />);
        await settle();
        expect(showNotification).toHaveBeenCalledWith('ドル円 -2.20%（24時間）', expect.objectContaining({ data: { url: '/markets' } }));
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    });

    it('取得に失敗しても落ちず、次の回に任せる', async () => {
        const { shown } = installNotification('granted');
        localStorage.setItem(ALERTS_ENABLED_KEY, 'on');
        respond = () => new Response('', { status: 500 });
        render(<MoveAlertsWatcher />);
        await settle();
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await settle();
        respond = () => { throw new Error('offline'); };
        await act(async () => { vi.advanceTimersByTime(60_000); });
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(shown).toHaveLength(0);
    });
});

describe('ティッカーと Sparkline', () => {
    const data: SymbolMarketData[] = [
        { symbol: 'JPY=X', name: 'USD/JPY', price: '158.33', change: '+1.00', changePercent: '+0.64%', direction: 'up', history: [1, 2, 3] },
        { symbol: '^N225', name: '日経225', price: '--', change: '--', changePercent: '--', direction: 'flat', history: [] },
        { symbol: 'CL=F', name: '原油WTI', price: '$70.00', change: '-1.00', changePercent: '-1.40%', direction: 'down', history: [5] },
    ];

    it('取得した値をティッカーと Sparkline に配る。取れていない銘柄の Sparkline は出さない', async () => {
        respond = () => json({ data });
        const { container } = render(
            <MarketDataProvider>
                <MarketTicker />
                <Sparkline symbol="USD/JPY" />
                <Sparkline symbol="日経225" />
                <Sparkline symbol="原油WTI" compact />
            </MarketDataProvider>,
        );
        await waitFor(() => expect(container.querySelectorAll('.ticker-item')).toHaveLength(6)); // 2 セット
        expect(container.querySelector('.ticker-up')?.textContent).toContain('▲');
        expect(container.querySelector('.ticker-down')?.textContent).toContain('▼');
        // USD/JPY はチャートつき、原油は点が 1 つなのでチャートなし、日経は出さない
        const chips = [...container.querySelectorAll('div.inline-flex.font-mono')];
        expect(chips.map(c => [c.textContent?.slice(0, 7), !!c.querySelector('svg')])).toEqual([['USD/JPY', true], ['原油WTI$7', false]]);
        fireEvent.mouseEnter(container.querySelector('.ticker-wrapper')!);
        expect(container.querySelector('.ticker-paused')).toBeTruthy();
        fireEvent.mouseLeave(container.querySelector('.ticker-wrapper')!);
        expect(container.querySelector('.ticker-paused')).toBeNull();
    });

    it('取得できなければティッカーを出さない', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        respond = () => new Response('', { status: 500 });
        const { container } = render(<MarketDataProvider><MarketTicker /></MarketDataProvider>);
        await waitFor(() => expect(console.error).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });
});
