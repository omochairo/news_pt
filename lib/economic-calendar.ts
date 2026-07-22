export interface EconomicEvent {
    id: string;
    date: string;          // YYYY-MM-DD
    time: string;          // HH:MM (JST)
    country: 'US' | 'JP' | 'EU' | 'UK';
    countryName: string;
    flag: string;
    event: string;
    importance: 'high' | 'medium';
    previous: string;
    forecast: string;
    actual?: string;
}

export const ECONOMIC_EVENTS: EconomicEvent[] = [
    {
        id: '1',
        date: '2026-07-22',
        time: '21:30',
        country: 'US',
        countryName: '米国',
        flag: '🇺🇸',
        event: '米 CPI (消費者物価指数) 発表',
        importance: 'high',
        previous: '3.3%',
        forecast: '3.1%',
        actual: '3.0%',
    },
    {
        id: '2',
        date: '2026-07-23',
        time: '08:50',
        country: 'JP',
        countryName: '日本',
        flag: '🇯🇵',
        event: '日本 貿易収支 (6月)',
        importance: 'medium',
        previous: '-1.2兆円',
        forecast: '-0.8兆円',
    },
    {
        id: '3',
        date: '2026-07-24',
        time: '21:30',
        country: 'US',
        countryName: '米国',
        flag: '🇺🇸',
        event: '米 PCE デフレータ (コア物価指数)',
        importance: 'high',
        previous: '2.6%',
        forecast: '2.5%',
    },
    {
        id: '4',
        date: '2026-07-30',
        time: '27:00', // 翌03:00
        country: 'US',
        countryName: '米国',
        flag: '🇺🇸',
        event: 'FOMC 政策金利発表 & パウエル議長会見',
        importance: 'high',
        previous: '5.25%',
        forecast: '5.25%',
    },
    {
        id: '5',
        date: '2026-07-31',
        time: '12:00',
        country: 'JP',
        countryName: '日本',
        flag: '🇯🇵',
        event: '日銀 金融政策決定会合 政策金利発表 & 植田総裁会見',
        importance: 'high',
        previous: '0.10%',
        forecast: '0.25%',
    },
    {
        id: '6',
        date: '2026-08-01',
        time: '21:30',
        country: 'US',
        countryName: '米国',
        flag: '🇺🇸',
        event: '米 雇用統計 (非農業部門雇用者数 & 失業率)',
        importance: 'high',
        previous: '20.6万人',
        forecast: '19.0万人',
    },
    {
        id: '7',
        date: '2026-08-06',
        time: '21:15',
        country: 'EU',
        countryName: 'ユーロ圏',
        flag: '🇪🇺',
        event: 'ECB 政策金利発表 & ラガルド総裁会見',
        importance: 'high',
        previous: '4.25%',
        forecast: '4.00%',
    },
];

/**
 * イベントの開催までの時間カウントダウン文字列を取得する
 */
export function getEventTimeLeft(eventDateStr: string, eventTimeStr: string): string {
    const now = new Date();
    const [year, month, day] = eventDateStr.split('-').map(Number);
    const [hour, minute] = eventTimeStr.split(':').map(Number);

    const eventDate = new Date(year, month - 1, day, hour, minute);
    const diffMs = eventDate.getTime() - now.getTime();

    if (diffMs < 0 && diffMs > -4 * 60 * 60 * 1000) {
        return '速報対応中 / 開催中';
    }
    if (diffMs <= -4 * 60 * 60 * 1000) {
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
