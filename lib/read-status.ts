/**
 * ニュース記事の既読状態管理
 * localStorage に既読URLを保存 (最大1000件保持)
 */

const READ_STATUS_STORAGE_KEY = 'vantage-point-read-urls';
const MAX_READ_HISTORY = 1000;

export function getReadUrls(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(READ_STATUS_STORAGE_KEY);
        const list: string[] = raw ? JSON.parse(raw) : [];
        return new Set(list);
    } catch {
        return new Set();
    }
}

export function markAsRead(url: string): Set<string> {
    if (typeof window === 'undefined' || !url) return getReadUrls();

    try {
        const readSet = getReadUrls();
        if (readSet.has(url)) return readSet;

        readSet.add(url);
        const updatedList = Array.from(readSet);

        // 最大件数を超えたら古いものを削除
        if (updatedList.length > MAX_READ_HISTORY) {
            updatedList.splice(0, updatedList.length - MAX_READ_HISTORY);
        }

        localStorage.setItem(READ_STATUS_STORAGE_KEY, JSON.stringify(updatedList));
        return new Set(updatedList);
    } catch (e) {
        console.error('Failed to mark as read:', e);
        return getReadUrls();
    }
}

export function isRead(url: string, readUrls: Set<string>): boolean {
    return readUrls.has(url);
}
