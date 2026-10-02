// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBookmark, getBookmarks, isBookmarked, removeBookmark } from '../lib/bookmarks';
import { getDailyHistory, saveToDailyHistory } from '../lib/history';
import { getReadUrls, isRead, markAsRead } from '../lib/read-status';
import { FAVORITES_STORAGE_KEY, readFavorites, saveFavorites } from '../lib/favorites';
import {
    ALERTS_CHANGE_EVENT,
    ALERTS_ENABLED_KEY,
    ALERTS_STATE_KEY,
    readAlertState,
    readAlertsEnabled,
    saveAlertState,
    saveAlertsEnabled,
} from '../lib/move-alerts';
import { MARKETS } from '../lib/world-markets';
import type { NewsItem } from '../lib/parser';

const item = (url: string, isoDate?: string): NewsItem => ({ title: `t-${url}`, url, source: 'Reuters', time: '10:00', isoDate });

beforeEach(() => localStorage.clear());
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

/** localStorage が使えない環境（プライベートモード・容量超過）を再現する */
function breakStorage() {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
}

describe('bookmarks', () => {
    it('追加は先頭に入り、同じ URL は重ねない。削除・判定ができる', () => {
        addBookmark({ url: 'a', title: 'A', source: 'Nikkei' });
        const list = addBookmark({ url: 'b', title: 'B', source: 'CNN' });
        expect(list.map(b => b.url)).toEqual(['b', 'a']);
        expect(list[0].savedAt).toMatch(/^\d{4}-/);
        expect(addBookmark({ url: 'a', title: 'A2', source: 'Nikkei' })).toHaveLength(2);
        expect(isBookmarked('a')).toBe(true);
        expect(removeBookmark('a').map(b => b.url)).toEqual(['b']);
        expect(isBookmarked('a')).toBe(false);
    });

    it('壊れた保存値は空として扱う', () => {
        localStorage.setItem('vantage-point-bookmarks', '{');
        expect(getBookmarks()).toEqual([]);
    });
});

describe('history', () => {
    it('当日（JST）の履歴に新しい順で重複なしに追記する', () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T15:30:00Z'), toFake: ['Date'] }); // JST 10/2 00:30
        saveToDailyHistory([item('a', '2026-10-01T14:00:00Z'), item('b', '2026-10-01T15:00:00Z')]);
        saveToDailyHistory([item('a', '2026-10-01T14:00:00Z'), item('c')]);
        const [day] = getDailyHistory();
        expect(day.date).toBe('2026-10-02');
        // 日付の無い記事は最後
        expect(day.items.map(i => i.url)).toEqual(['b', 'a', 'c']);
    });

    it('1 日 300 件・30 日分までに抑える', () => {
        const old = Array.from({ length: 30 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, items: [] }));
        localStorage.setItem('vantage-point-history', JSON.stringify(old));
        vi.useFakeTimers({ now: new Date('2026-10-01T03:00:00Z'), toFake: ['Date'] });
        saveToDailyHistory(Array.from({ length: 310 }, (_, i) => item(`u${i}`, new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString())));
        const history = getDailyHistory();
        expect(history).toHaveLength(30);
        expect(history.at(-1)!.date).toBe('2026-10-01');
        expect(history.at(-1)!.items).toHaveLength(300);
        expect(history.at(-1)!.items[0].url).toBe('u309');
    });

    it('空の入力では書かず、保存に失敗してもエラーを外へ投げない', () => {
        saveToDailyHistory([]);
        expect(localStorage.getItem('vantage-point-history')).toBeNull();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        breakStorage();
        expect(() => saveToDailyHistory([item('a')])).not.toThrow();
        expect(error).toHaveBeenCalled();
        expect(getDailyHistory()).toEqual([]);
    });
});

describe('read-status', () => {
    it('既読を追加し、1000 件を超えたら古い順に捨てる', () => {
        localStorage.setItem('vantage-point-read-urls', JSON.stringify(Array.from({ length: 1000 }, (_, i) => `u${i}`)));
        const set = markAsRead('new');
        expect(set.size).toBe(1000);
        expect(set.has('u0')).toBe(false);
        expect(isRead('new', set)).toBe(true);
        // 既読済み・空の URL は何も変えない
        expect(markAsRead('new').size).toBe(1000);
        expect(markAsRead('').size).toBe(1000);
    });

    it('保存に失敗したら読める範囲の値を返す', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        breakStorage();
        expect(markAsRead('a').size).toBe(0);
        expect(getReadUrls().size).toBe(0);
    });
});

describe('favorites の保存', () => {
    it('保存した値を読み戻せる', () => {
        const [a, b] = MARKETS.map(m => m.symbol);
        saveFavorites([b, a]);
        expect(localStorage.getItem(FAVORITES_STORAGE_KEY)).toBe(JSON.stringify([b, a]));
        expect(readFavorites()).toEqual([a, b]);
    });

    it('localStorage が使えなくても落ちない', () => {
        breakStorage();
        expect(() => saveFavorites(['x'])).not.toThrow();
        expect(readFavorites()).toEqual([]);
    });
});

describe('move-alerts の保存', () => {
    it('オン・オフを保存し、変更をイベントで知らせる', () => {
        const listener = vi.fn();
        window.addEventListener(ALERTS_CHANGE_EVENT, listener);
        saveAlertsEnabled(true);
        expect(localStorage.getItem(ALERTS_ENABLED_KEY)).toBe('on');
        expect(readAlertsEnabled()).toBe(true);
        saveAlertsEnabled(false);
        expect(readAlertsEnabled()).toBe(false);
        expect(listener).toHaveBeenCalledTimes(2);
        window.removeEventListener(ALERTS_CHANGE_EVENT, listener);
    });

    it('通知済みの状態は数値だけ読み戻し、壊れた値は空にする', () => {
        saveAlertState({ 'JPY=X': 2 });
        expect(readAlertState()).toEqual({ 'JPY=X': 2 });
        localStorage.setItem(ALERTS_STATE_KEY, JSON.stringify({ 'JPY=X': 'x', 'BTC-JPY': -3 }));
        expect(readAlertState()).toEqual({ 'BTC-JPY': -3 });
        localStorage.setItem(ALERTS_STATE_KEY, '[1]');
        expect(readAlertState()).toEqual({});
        localStorage.setItem(ALERTS_STATE_KEY, '{');
        expect(readAlertState()).toEqual({});
    });

    it('localStorage が使えなくても落ちない', () => {
        breakStorage();
        expect(() => saveAlertsEnabled(true)).not.toThrow();
        expect(() => saveAlertState({ a: 1 })).not.toThrow();
        expect(readAlertsEnabled()).toBe(false);
        expect(readAlertState()).toEqual({});
    });
});
