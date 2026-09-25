import { NewsItem } from './parser';

const HISTORY_KEY = 'vantage-point-history';
const MAX_ITEMS_PER_DAY = 300;

function toEpoch(item: NewsItem): number {
    const t = item.isoDate ? new Date(item.isoDate).getTime() : NaN;
    return Number.isNaN(t) ? 0 : t;
}

export interface DailyHistory {
    date: string; // YYYY-MM-DD format
    items: NewsItem[];
}

/**
 * 取得したニュースを本日の履歴としてローカルストレージにマージ保存する
 */
export function saveToDailyHistory(news: NewsItem[]) {
    if (typeof window === 'undefined' || news.length === 0) return;

    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        let history: DailyHistory[] = raw ? JSON.parse(raw) : [];

        // 日本時間の YYYY-MM-DD を取得
        const now = new Date();
        const jstOffset = 9 * 60; // 9 hours in minutes
        const jstDate = new Date(now.getTime() + (jstOffset + now.getTimezoneOffset()) * 60000);
        const todayDate = `${jstDate.getFullYear()}-${String(jstDate.getMonth() + 1).padStart(2, '0')}-${String(jstDate.getDate()).padStart(2, '0')}`;
        
        // 該当日の履歴レコードを探す
        let todayRecord = history.find(h => h.date === todayDate);
        if (!todayRecord) {
            todayRecord = { date: todayDate, items: [] };
            history.push(todayRecord);
        }

        // 既存のURLセットを作成して重複をチェック
        const existingUrls = new Set(todayRecord.items.map(i => i.url));
        let addedCount = 0;
        
        news.forEach(item => {
            if (!existingUrls.has(item.url)) {
                todayRecord!.items.push(item);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            // 時間順（新しい順）にソート。表示用の time は "14:00" と "7/22 14:00" が混ざり
            // 文字列比較では前日の記事が上に来るので、isoDate で比べる
            todayRecord.items.sort((a, b) => toEpoch(b) - toEpoch(a));
            // 1日あたりの件数に上限を設けて localStorage の容量超過を防ぐ
            if (todayRecord.items.length > MAX_ITEMS_PER_DAY) {
                todayRecord.items = todayRecord.items.slice(0, MAX_ITEMS_PER_DAY);
            }
            
            // 最大過去30日分だけ保持してストレージ容量を節約
            if (history.length > 30) {
                history = history.slice(-30);
            }
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        }
    } catch (e) {
        console.error('Failed to save daily history', e);
    }
}

/**
 * 保存された日別履歴の全データを取得する
 */
export function getDailyHistory(): DailyHistory[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}
