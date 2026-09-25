import axios from 'axios';
import * as cheerio from 'cheerio';
import { EconomicEvent, EventSource } from './economic-calendar';

/**
 * 中央銀行の公式ページから会合日程を取得する（サーバー側専用）。
 * 米雇用統計・CPI（BLS）は機械的な取得を 403 で拒否されるため、ここでは扱わない。
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function get(url: string, responseType: 'text' | 'json' = 'text') {
    const res = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8' },
        timeout: 10000,
        responseType: 'text',
    });
    const body = String(res.data).replace(/^﻿/, '');
    return responseType === 'json' ? JSON.parse(body) : body;
}

/** 指定タイムゾーンの壁時計時刻を絶対時刻に変換する（夏時間を考慮） */
function zonedTimeToDate(y: number, m: number, d: number, hh: number, mm: number, timeZone: string): Date {
    const asUtc = Date.UTC(y, m - 1, d, hh, mm);
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(asUtc));
    const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return new Date(asUtc - (shown - asUtc));
}

/** 絶対時刻を JST の YYYY-MM-DD / HH:MM に */
function toJstParts(date: Date): { date: string; time: string } {
    const f = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(date);
    const p = (t: string) => f.find(x => x.type === t)?.value ?? '';
    return { date: `${p('year')}-${p('month')}-${p('day')}`, time: `${p('hour')}:${p('minute')}` };
}

function makeEvent(source: EventSource, at: Date, base: Omit<EconomicEvent, 'id' | 'date' | 'time' | 'source'>): EconomicEvent {
    const { date, time } = toJstParts(at);
    return { id: `${source}-${date}`, date, time, source, ...base };
}

/** FOMC: FRB の公開カレンダー JSON（"FOMC Meeting" の日時は声明の発表時刻、米東部時間） */
export async function fetchFomcEvents(): Promise<EconomicEvent[]> {
    const json = await get('https://www.federalreserve.gov/json/calendar.json', 'json');
    const events: EconomicEvent[] = [];
    for (const e of json?.events ?? []) {
        if (typeof e?.title !== 'string' || e.title.toLowerCase() !== 'fomc meeting') continue;
        const [y, m] = String(e.month).split('-').map(Number);
        const d = Number(String(e.days).split('-').pop());
        const t = /(\d{1,2}):(\d{2})\s*([ap])\.?m/i.exec(String(e.time));
        if (!y || !m || !d || !t) continue;
        let hh = Number(t[1]) % 12;
        if (t[3].toLowerCase() === 'p') hh += 12;
        events.push(makeEvent('fomc', zonedTimeToDate(y, m, d, hh, Number(t[2]), 'America/New_York'), {
            country: 'US', countryName: '米国', flag: '🇺🇸', event: 'FOMC 政策金利発表 & 議長会見',
            importance: 'high', previous: '—', forecast: '—',
        }));
    }
    return events;
}

/** ECB: 理事会日程ページ。金融政策会合の2日目 14:15 (フランクフルト時間) に政策金利を発表 */
export async function fetchEcbEvents(): Promise<EconomicEvent[]> {
    const $ = cheerio.load(await get('https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html'));
    const events: EconomicEvent[] = [];
    $('dt').each((_, el) => {
        const dateText = $(el).text().trim();
        const desc = $(el).next('dd').text();
        const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
        if (!m || !/monetary policy meeting/i.test(desc) || !/Day 2/i.test(desc)) return;
        events.push(makeEvent('ecb', zonedTimeToDate(Number(m[3]), Number(m[2]), Number(m[1]), 14, 15, 'Europe/Berlin'), {
            country: 'EU', countryName: 'ユーロ圏', flag: '🇪🇺', event: 'ECB 政策金利発表 & 総裁会見',
            importance: 'high', previous: '—', forecast: '—',
        }));
    });
    return events;
}

/** 日銀: 金融政策決定会合の日程表。最終日の昼頃（時刻は目安）に結果を公表 */
export async function fetchBojEvents(): Promise<EconomicEvent[]> {
    const $ = cheerio.load(await get('https://www.boj.or.jp/mopo/mpmsche_minu/index.htm'));
    const events: EconomicEvent[] = [];
    // 年ごとの表。caption が「表　2026年」の形
    $('table').each((_, table) => {
        const year = Number(/(\d{4})年/.exec($(table).find('caption').text())?.[1]);
        $(table).find('tr').each((_, tr) => {
            const cell = $(tr).find('td').first().text().trim();
            // 例: "10月29日（木）・30日（金）" / "4月30日（木）・5月1日（金）"
            const first = /^(\d{1,2})月\s*(\d{1,2})日/.exec(cell);
            if (!year || !first) return;
            const last = /・\s*(?:(\d{1,2})月)?\s*(\d{1,2})日/.exec(cell);
            const month = Number(last?.[1] ?? first[1]);
            const day = Number(last?.[2] ?? first[2]);
            events.push(makeEvent('boj', zonedTimeToDate(year, month, day, 12, 0, 'Asia/Tokyo'), {
                country: 'JP', countryName: '日本', flag: '🇯🇵', event: '日銀 金融政策決定会合 結果公表 (時刻は目安)',
                importance: 'high', previous: '—', forecast: '—',
            }));
        });
    });
    return events;
}
