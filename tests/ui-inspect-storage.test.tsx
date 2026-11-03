// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addBookmark, getBookmarks, isBookmarked, removeBookmark } from '../lib/bookmarks';
import { getDailyHistory } from '../lib/history';
import { getReadUrls } from '../lib/read-status';

vi.mock('next/link', () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
import Home from '../app/page';

beforeEach(() => localStorage.clear());
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ブックマーク: 保存値が配列でない・保存できない', () => {
    it('保存値が JSON として正しくても配列でなければ空として扱い、追加で落ちない', () => {
        localStorage.setItem('vantage-point-bookmarks', '{"a":1}');
        expect(getBookmarks()).toEqual([]);
        expect(isBookmarked('x')).toBe(false);
        expect(addBookmark({ url: 'x', title: 'X', source: 'Nikkei' })).toHaveLength(1);
    });

    it('保存に失敗しても追加・削除が例外を投げず、結果の一覧を返す', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        expect(() => addBookmark({ url: 'x', title: 'X', source: 'Nikkei' })).not.toThrow();
        expect(() => removeBookmark('x')).not.toThrow();
    });
});

describe('履歴・既読: 保存値が配列でない', () => {
    it('履歴が配列でなければ空を返す', () => {
        localStorage.setItem('vantage-point-history', '{"a":1}');
        expect(getDailyHistory()).toEqual([]);
    });
    it('既読が配列でなければ空を返す', () => {
        localStorage.setItem('vantage-point-read-urls', '{"a":1}');
        expect(getReadUrls().size).toBe(0);
    });
});

describe('ホーム画面: localStorage が読めない環境', () => {
    it('表示モードの復元で例外が出ても画面が描画される', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
        window.scrollTo = vi.fn();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await act(async () => { render(<Home />); });
        expect(document.body.textContent).not.toBe('');
        expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
    });
});
