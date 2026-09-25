export interface EconomicEvent {
    id: string;
    date: string;          // YYYY-MM-DD
    time: string;          // HH:MM (JST。24時超え表記は使わず翌日の日付にする)
    country: 'US' | 'JP' | 'EU' | 'UK';
    countryName: string;
    flag: string;
    event: string;
    importance: 'high' | 'medium';
    previous: string;
    forecast: string;
    actual?: string;
}

/**
 * 予定表（手動更新）。出典:
 *  - FOMC: https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
 *  - ECB:  https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html
 *  - 日銀: https://www.boj.or.jp/mopo/mpmsche_minu/index.htm
 *  - 米雇用統計 / CPI: https://www.bls.gov/schedule/news_release/
 * 欧州は 10/25、米国は 11/1 に夏時間が終わるので、それ以降は JST で1時間遅くなる。
 * 前回値・予想値は未入力（'—'）。
 */
export const ECONOMIC_EVENTS: EconomicEvent[] = [
    { id: '1', date: '2026-10-02', time: '21:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 雇用統計 (9月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '2', date: '2026-10-14', time: '21:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 CPI (消費者物価指数, 9月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '3', date: '2026-10-29', time: '03:00', country: 'US', countryName: '米国', flag: '🇺🇸', event: 'FOMC 政策金利発表 & 議長会見', importance: 'high', previous: '—', forecast: '—' },
    { id: '4', date: '2026-10-29', time: '22:15', country: 'EU', countryName: 'ユーロ圏', flag: '🇪🇺', event: 'ECB 政策金利発表 & 総裁会見', importance: 'high', previous: '—', forecast: '—' },
    { id: '5', date: '2026-10-30', time: '12:00', country: 'JP', countryName: '日本', flag: '🇯🇵', event: '日銀 金融政策決定会合 結果公表 (時刻は目安)', importance: 'high', previous: '—', forecast: '—' },
    { id: '6', date: '2026-11-06', time: '22:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 雇用統計 (10月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '7', date: '2026-11-10', time: '22:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 CPI (消費者物価指数, 10月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '8', date: '2026-12-04', time: '22:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 雇用統計 (11月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '9', date: '2026-12-10', time: '04:00', country: 'US', countryName: '米国', flag: '🇺🇸', event: 'FOMC 政策金利発表 & 議長会見', importance: 'high', previous: '—', forecast: '—' },
    { id: '10', date: '2026-12-10', time: '22:30', country: 'US', countryName: '米国', flag: '🇺🇸', event: '米 CPI (消費者物価指数, 11月分)', importance: 'high', previous: '—', forecast: '—' },
    { id: '11', date: '2026-12-17', time: '22:15', country: 'EU', countryName: 'ユーロ圏', flag: '🇪🇺', event: 'ECB 政策金利発表 & 総裁会見', importance: 'high', previous: '—', forecast: '—' },
    { id: '12', date: '2026-12-18', time: '12:00', country: 'JP', countryName: '日本', flag: '🇯🇵', event: '日銀 金融政策決定会合 結果公表 (時刻は目安)', importance: 'high', previous: '—', forecast: '—' },
];

/** JST で書かれた日付・時刻を絶対時刻に変換する（閲覧端末のタイムゾーンに依存させない） */
export function toJstDate(eventDateStr: string, eventTimeStr: string): Date {
    const [hour, minute] = eventTimeStr.split(':');
    return new Date(`${eventDateStr}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00+09:00`);
}

const ENDED_WINDOW_MS = 4 * 60 * 60 * 1000;
const HIDE_AFTER_MS = 24 * 60 * 60 * 1000;

/** 終了から24時間以上たったイベントを除き、日時順に並べる */
export function getUpcomingEvents(now: Date = new Date()): EconomicEvent[] {
    return ECONOMIC_EVENTS
        .filter(e => toJstDate(e.date, e.time).getTime() - now.getTime() > -HIDE_AFTER_MS)
        .sort((a, b) => toJstDate(a.date, a.time).getTime() - toJstDate(b.date, b.time).getTime());
}

/**
 * イベントの開催までの時間カウントダウン文字列を取得する
 */
export function getEventTimeLeft(eventDateStr: string, eventTimeStr: string, now: Date = new Date()): string {
    const eventDate = toJstDate(eventDateStr, eventTimeStr);
    const diffMs = eventDate.getTime() - now.getTime();

    if (diffMs < 0 && diffMs > -ENDED_WINDOW_MS) {
        return '速報対応中 / 開催中';
    }
    if (diffMs <= -ENDED_WINDOW_MS) {
        return '終了';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `あと${diffDays}日`;
    } else if (diffHours > 0) {
        return `あと${diffHours}時間`;
    } else {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `あと${Math.max(1, diffMins)}分`;
    }
}
