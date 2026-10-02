import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';
import { fetchBojEvents, fetchEcbEvents, fetchFomcEvents } from '../lib/calendar-fetch';
import { ECONOMIC_EVENTS, EconomicEvent, getEventTimeLeft, getUpcomingEvents, toJstDate } from '../lib/economic-calendar';

const get = vi.mocked(axios.get);
const reply = (body: string) => get.mockResolvedValue({ data: body });
const ev = (id: string, date: string, time: string): EconomicEvent => ({ ...ECONOMIC_EVENTS[0], id, date, time });

beforeEach(() => get.mockReset());
afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
});

describe('calendar-fetch', () => {
    it('FOMC: "FOMC Meeting" だけを拾い、米東部時間（夏時間込み）を JST にする', async () => {
        // 先頭の BOM も落とす
        reply('﻿' + JSON.stringify({ events: [
            { title: 'FOMC Meeting', month: '2026-10', days: '27-28', time: '2:00 p.m.' },
            { title: 'FOMC Meeting', month: '2026-12', days: '8-9', time: '2:00 p.m.' },
            { title: 'FOMC Minutes', month: '2026-10', days: '8', time: '2:00 p.m.' },
            { title: 'FOMC Meeting', month: '2026-11', days: '3', time: 'TBD' },
        ] }));
        const events = await fetchFomcEvents();
        expect(events.map(e => [e.id, e.date, e.time])).toEqual([
            ['fomc-2026-10-29', '2026-10-29', '03:00'], // EDT (UTC-4)
            ['fomc-2026-12-10', '2026-12-10', '04:00'], // EST (UTC-5)
        ]);
        expect(events[0]).toMatchObject({ source: 'fomc', country: 'US', importance: 'high' });
    });

    it('ECB: 金融政策会合の 2 日目 14:15（フランクフルト時間）', async () => {
        reply(`<dl>
            <dt>28/10/2026</dt><dd>Governing Council of the ECB: monetary policy meeting (Day 1)</dd>
            <dt>29/10/2026</dt><dd>Governing Council of the ECB: monetary policy meeting (Day 2), followed by press conference</dd>
            <dt>04/11/2026</dt><dd>Non-monetary policy meeting</dd>
            <dt>17/12/2026</dt><dd>monetary policy meeting (Day 2)</dd>
        </dl>`);
        expect((await fetchEcbEvents()).map(e => [e.date, e.time])).toEqual([['2026-10-29', '22:15'], ['2026-12-17', '22:15']]);
    });

    it('日銀: 年ごとの表から最終日（月またぎも）を取る', async () => {
        reply(`
            <table><caption>表　2026年</caption>
              <tr><th>会合</th></tr>
              <tr><td>10月29日（木）・30日（金）</td></tr>
              <tr><td>4月30日（木）・5月1日（金）</td></tr>
              <tr><td>未定</td></tr>
            </table>
            <table><caption>注記</caption><tr><td>1月1日</td></tr></table>`);
        expect((await fetchBojEvents()).map(e => [e.date, e.time])).toEqual([['2026-10-30', '12:00'], ['2026-05-01', '12:00']]);
    });
});

describe('economic-calendar', () => {

    it('toJstDate は端末のタイムゾーンに依存しない', () => {
        expect(toJstDate('2026-10-02', '9:05').toISOString()).toBe('2026-10-02T00:05:00.000Z');
    });

    it('終了から 24 時間以上たったものを除き、日時順に並べる', () => {
        const now = new Date('2026-10-10T00:00:00Z');
        const events = [ev('late', '2026-10-20', '10:00'), ev('old', '2026-10-08', '09:00'), ev('recent', '2026-10-09', '12:00')];
        expect(getUpcomingEvents(events, now).map(e => e.id)).toEqual(['recent', 'late']);
    });

    it('残り時間の表示', () => {
        const now = new Date('2026-10-02T00:00:00Z'); // JST 09:00
        expect(getEventTimeLeft('2026-10-05', '09:00', now)).toBe('あと3日');
        expect(getEventTimeLeft('2026-10-02', '14:00', now)).toBe('あと5時間');
        expect(getEventTimeLeft('2026-10-02', '09:30', now)).toBe('あと30分');
        expect(getEventTimeLeft('2026-10-02', '09:00', new Date(now.getTime() - 10_000))).toBe('あと1分');
        expect(getEventTimeLeft('2026-10-02', '08:00', now)).toBe('速報対応中 / 開催中');
        expect(getEventTimeLeft('2026-10-02', '04:00', now)).toBe('終了');
    });
});

describe('/api/calendar', () => {
    async function loadRoute(fetchers: Record<'fetchFomcEvents' | 'fetchEcbEvents' | 'fetchBojEvents', () => Promise<EconomicEvent[]>>) {
        vi.resetModules();
        vi.doMock('../lib/calendar-fetch', () => fetchers);
        return import('../app/api/calendar/route');
    }

    it('取れた取得元は live、取れなかった取得元は手動の予定表で補い、半年先までに絞る', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z'), toFake: ['Date'] });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { GET } = await loadRoute({
            fetchFomcEvents: async () => [ev('fomc-live', '2026-11-05', '03:00'), ev('fomc-far', '2027-12-01', '03:00')].map(e => ({ ...e, source: 'fomc' as const })),
            fetchEcbEvents: async () => { throw new Error('blocked'); },
            fetchBojEvents: async () => [],
        });
        const body = await (await GET()).json();
        expect(body.sources).toEqual({ bls: 'static', fomc: 'live', ecb: 'static', boj: 'static' });
        const ids: string[] = body.events.map((e: EconomicEvent) => e.id);
        expect(ids).toContain('fomc-live');
        expect(ids).not.toContain('fomc-far');
        expect(ids).toContain('static-4'); // ECB の手動分
        expect(ids).not.toContain('static-3'); // FOMC は live を使うので手動分は入れない
        vi.useRealTimers();
    });

    it('12 時間はキャッシュを返し、取得元へは行かない', async () => {
        const fomc = vi.fn(async () => [] as EconomicEvent[]);
        const { GET } = await loadRoute({ fetchFomcEvents: fomc, fetchEcbEvents: async () => [], fetchBojEvents: async () => [] });
        await GET();
        await GET();
        expect(fomc).toHaveBeenCalledTimes(1);
    });
});
