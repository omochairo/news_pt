// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewsItem, NewsSource } from '../lib/parser';

vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import Home from '../app/page';
import HistoryList from '../components/HistoryList';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

const NOW = new Date('2026-10-01T03:00:00Z');
let seq = 0;
function news(source: NewsSource, title: string, minutesAgo: number): NewsItem {
    seq++;
    return { title, url: `https://example.com/${source}/${seq}`, source, time: '11:00', isoDate: new Date(NOW.getTime() - minutesAgo * 60_000).toISOString() };
}

let newsBody: Record<string, unknown>;
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('/api/news')) return new Response(JSON.stringify(newsBody));
    if (url.startsWith('/api/market')) return new Response(JSON.stringify({ data: [
        { symbol: 'JPY=X', name: 'USD/JPY', price: '158.33', change: '+1.00', changePercent: '+0.64%', direction: 'up', history: [1, 2] },
    ] }));
    if (url.startsWith('/api/calendar')) return new Response(JSON.stringify({ events: [
        { id: 'x', source: 'boj', date: '2026-10-30', time: '12:00', country: 'JP', countryName: '日本', flag: '🇯🇵', event: '日銀 会合（テスト）', importance: 'high', previous: '—', forecast: '—' },
    ] }));
    return new Response('', { status: 404 });
});

beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    localStorage.clear();
    newsBody = {
        nikkei: [news('Nikkei', '日経平均が続伸、半導体株が高い', 5), news('Nikkei', '日銀が利上げを決定した', 30)],
        minkabu: [news('MinkabuFX', 'ドル円は158円台で推移している', 10)],
        crypto: [news('Crypto', 'ビットコインが急伸している', 15)],
        bloomberg: [news('Bloomberg', '日銀の利上げで円高が進む', 20)],
        reuters: [news('Reuters', '原油価格が上昇しOPECが会合', 25)],
        cnn: [news('CNN', '米大統領が演説を行った', 40)],
        updatedAt: NOW.toISOString(),
    };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
    window.scrollTo = vi.fn();
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function renderHome() {
    const view = render(<Home />);
    await screen.findAllByText('日経平均が続伸、半導体株が高い');
    return view;
}

describe('ニュース画面', () => {
    it('全媒体を新しい順に並べ、相場ティッカーも出す', async () => {
        const { container } = await renderHome();
        const titles = [...container.querySelectorAll('h2, h3, h4')].map(e => e.textContent);
        expect(titles.indexOf('日経平均が続伸、半導体株が高い')).toBeLessThan(titles.indexOf('米大統領が演説を行った'));
        await waitFor(() => expect(container.querySelector('.ticker-item')).toBeTruthy());
    });

    it('検索・カテゴリ・トレンド語で絞り込む', async () => {
        await renderHome();
        fireEvent.change(screen.getByPlaceholderText(/ヘッドラインを検索/), { target: { value: '原油' } });
        expect(screen.queryByText('米大統領が演説を行った')).toBeNull();
        expect(screen.getAllByText('原油価格が上昇しOPECが会合').length).toBeGreaterThan(0);
        fireEvent.change(screen.getByPlaceholderText(/ヘッドラインを検索/), { target: { value: '' } });
        fireEvent.click(screen.getByTitle('暗号資産'));
        await waitFor(() => expect(screen.queryByText('米大統領が演説を行った')).toBeNull());
        expect(screen.getAllByText('ビットコインが急伸している').length).toBeGreaterThan(0);
    });

    it('既読にした記事を「未読のみ」で隠し、設定を保存する', async () => {
        await renderHome();
        fireEvent.click(screen.getAllByText('米大統領が演説を行った')[0]);
        fireEvent.click(screen.getByTitle('既読の記事を隠す'));
        expect(localStorage.getItem('vantage-point-unread-only')).toBe('1');
        await waitFor(() => expect(screen.queryByText('米大統領が演説を行った')).toBeNull());
        fireEvent.click(screen.getByTitle('既読の記事を隠す'));
        expect(localStorage.getItem('vantage-point-unread-only')).toBe('0');
    });

    it('有料記事を一括で隠し、設定を保存する', async () => {
        (newsBody.bloomberg as NewsItem[]).push(news('Bloomberg', 'ブルームバーグの独自記事', 1));
        await renderHome();
        expect(screen.getAllByText('ブルームバーグの独自記事').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByTitle('有料記事を隠す'));
        expect(localStorage.getItem('vantage-point-hide-paywall')).toBe('1');
        // Bloomberg は全件有料扱い。無料の記事は残る
        await waitFor(() => expect(screen.queryByText('ブルームバーグの独自記事')).toBeNull());
        expect(screen.getAllByText('米大統領が演説を行った').length).toBeGreaterThan(0);
        fireEvent.click(screen.getByTitle('有料記事を表示する'));
        expect(localStorage.getItem('vantage-point-hide-paywall')).toBe('0');
        expect((await screen.findAllByText('ブルームバーグの独自記事')).length).toBeGreaterThan(0);
    });

    it('有料記事を隠す設定を次回も引き継ぐ', async () => {
        localStorage.setItem('vantage-point-hide-paywall', '1');
        (newsBody.bloomberg as NewsItem[]).push(news('Bloomberg', 'ブルームバーグの独自記事', 1));
        await renderHome();
        expect(screen.getByTitle('有料記事を表示する')).toBeTruthy();
        expect(screen.queryByText('ブルームバーグの独自記事')).toBeNull();
        // 分割表示（媒体ごとの元データを受け取る）でも隠れたまま
        fireEvent.click(screen.getByRole('button', { name: '画面分割表示' }));
        await waitFor(() => expect(localStorage.getItem('vantage-point-viewmode')).toBe('split'));
        expect(screen.queryByText('ブルームバーグの独自記事')).toBeNull();
    });

    it('媒体の切り替えで外せる（最後の 1 つは外せない）', async () => {
        await renderHome();
        for (const label of ['Nikkei', 'みんかぶ', 'Bloomberg', 'Reuters', 'CNN']) {
            const btn = screen.queryAllByRole('button').find(b => b.className.includes('source-toggle-btn') && b.textContent?.includes(label));
            if (btn) fireEvent.click(btn);
        }
        const active = screen.getAllByRole('button').filter(b => b.className.includes('source-toggle-active'));
        expect(active.length).toBeGreaterThanOrEqual(1);
        active.forEach(b => fireEvent.click(b));
        expect(screen.getAllByRole('button').filter(b => b.className.includes('source-toggle-active')).length).toBeGreaterThanOrEqual(1);
    });

    it('ブックマークの追加・一覧・削除', async () => {
        await renderHome();
        fireEvent.click(screen.getAllByTitle('ブックマーク')[1]);
        expect(JSON.parse(localStorage.getItem('vantage-point-bookmarks')!)).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'ブックマーク' }));
        const panel = (await screen.findByText(/1 件/)).closest('.bookmark-panel') as HTMLElement;
        fireEvent.click(within(panel).getByTitle('削除'));
        expect(JSON.parse(localStorage.getItem('vantage-point-bookmarks')!)).toHaveLength(0);
        fireEvent.click(document.querySelector('.bookmark-overlay')!);
        expect(document.querySelector('.bookmark-panel')).toBeNull();
    });

    it('表示モードを切り替えて保存する（ターミナル・分割）', async () => {
        const { unmount } = await renderHome();
        fireEvent.click(screen.getByRole('button', { name: 'ターミナル表示' }));
        expect(localStorage.getItem('vantage-point-viewmode')).toBe('terminal');
        fireEvent.click(screen.getAllByTitle('ブックマーク')[0]);
        fireEvent.click(screen.getByRole('button', { name: '画面分割表示' }));
        // パネル B は暗号資産だけ。パネルごとに検索できる
        fireEvent.change(screen.getByPlaceholderText('パネルAを検索...'), { target: { value: '原油' } });
        expect(screen.getAllByText('原油価格が上昇しOPECが会合').length).toBeGreaterThan(0);
        expect(screen.getAllByText('ビットコインが急伸している').length).toBeGreaterThan(0);
        unmount();
        render(<Home />);
        await screen.findByPlaceholderText('パネルBを検索...');
        fireEvent.click(screen.getByRole('button', { name: 'モダンカード表示' }));
        expect(localStorage.getItem('vantage-point-viewmode')).toBe('modern');
    });

    it('経済カレンダーとアーカイブを開いて閉じる', async () => {
        await renderHome();
        fireEvent.click(screen.getByTitle('経済指標・重要イベントカレンダー'));
        await screen.findByText('日銀 会合（テスト）');
        fireEvent.click(screen.getAllByRole('button', { name: '✕' })[0]);
        expect(screen.queryByText('Economic Calendar & Central Bank Schedules')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '過去の記事アーカイブ' }));
        const panel = (await screen.findByText(/記事アーカイブ/)).closest('.bookmark-panel') as HTMLElement;
        expect(within(panel).getByText('2026-10-01')).toBeTruthy();
        fireEvent.click(document.querySelector('.bookmark-overlay')!);
    });

    it('LAST SYNC は受け取った時刻でなくサーバーの取得時刻、更新ボタンはキャッシュを通さず取り直させる', async () => {
        newsBody.updatedAt = '2026-10-01T02:55:00.000Z';
        await renderHome();
        expect(screen.getByText('11:55:00')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ニュースを更新' })); });
        expect(fetchMock).toHaveBeenCalledWith('/api/news?refresh=true', { cache: 'no-store' });
    });

    it('更新ボタンで取り直し、失敗しても落ちない', async () => {
        await renderHome();
        const calls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/news')).length;
        vi.spyOn(console, 'error').mockImplementation(() => {});
        newsBody = null as never;
        fetchMock.mockImplementationOnce(async () => new Response('', { status: 500 }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'ニュースを更新' })); });
        expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/news')).length).toBe(calls + 1);
        expect(screen.getAllByText('日経平均が続伸、半導体株が高い').length).toBeGreaterThan(0);
    });

    it('下にスクロールすると「先頭へ」が出る', async () => {
        await renderHome();
        Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 });
        act(() => { window.dispatchEvent(new Event('scroll')); });
        fireEvent.click(await screen.findByRole('button', { name: 'ページの先頭へ' }));
        expect(window.scrollTo).toHaveBeenCalled();
    });
});

describe('HistoryList', () => {
    it('日付を選ぶとその日の記事を出し、履歴が無ければその旨を出す', () => {
        const onClose = vi.fn();
        const { rerender } = render(<HistoryList historyData={[]} onClose={onClose} />);
        expect(screen.getByText('履歴がありません')).toBeTruthy();
        rerender(<HistoryList onClose={onClose} historyData={[
            { date: '2026-09-30', items: [news('Reuters', '前日のニュース記事です', 0)] },
            { date: '2026-10-01', items: [news('CNN', '当日のニュース記事です', 0)] },
        ]} />);
        fireEvent.click(screen.getByText('2026-09-30'));
        expect(screen.getByText('前日のニュース記事です')).toBeTruthy();
    });
});

describe('PWAInstallPrompt', () => {
    it('インストールできるときだけボタンを出し、承認されたら消す', async () => {
        const register = vi.fn(async () => ({}));
        Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
        render(<PWAInstallPrompt />);
        expect(register).toHaveBeenCalledWith('/sw.js');
        expect(screen.queryByTitle('アプリをホーム画面にインストール')).toBeNull();
        const event = Object.assign(new Event('beforeinstallprompt'), { prompt: vi.fn(), userChoice: Promise.resolve({ outcome: 'accepted' }) });
        act(() => { window.dispatchEvent(event); });
        fireEvent.click(await screen.findByTitle('アプリをホーム画面にインストール'));
        await waitFor(() => expect(screen.queryByTitle('アプリをホーム画面にインストール')).toBeNull());
        expect(event.prompt).toHaveBeenCalled();
        delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    });
});
