/**
 * ブックマーク (後で読む) 管理
 * localStorage を使用してブラウザに保存
 */

const STORAGE_KEY = 'vantage-point-bookmarks';

export interface BookmarkedItem {
    url: string;
    title: string;
    source: 'Bloomberg' | 'Reuters' | 'CNN';
    savedAt: string;
}

/**
 * 保存済みブックマークを全件取得
 */
export function getBookmarks(): BookmarkedItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * ブックマークを追加
 */
export function addBookmark(item: Omit<BookmarkedItem, 'savedAt'>): BookmarkedItem[] {
    const bookmarks = getBookmarks();
    if (bookmarks.some(b => b.url === item.url)) return bookmarks; // 重複防止

    const newItem: BookmarkedItem = {
        ...item,
        savedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...bookmarks];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
}

/**
 * ブックマークを削除
 */
export function removeBookmark(url: string): BookmarkedItem[] {
    const bookmarks = getBookmarks().filter(b => b.url !== url);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
    return bookmarks;
}

/**
 * 指定URLがブックマーク済みか判定
 */
export function isBookmarked(url: string): boolean {
    return getBookmarks().some(b => b.url === url);
}
