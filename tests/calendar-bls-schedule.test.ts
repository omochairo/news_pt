import { describe, expect, it } from 'vitest';
import { ECONOMIC_EVENTS, toJstDate } from '@/lib/economic-calendar';

const bls = ECONOMIC_EVENTS.filter(e => e.source === 'bls');

describe('BLS（米雇用統計・CPI）の手動予定', () => {
    it('どれもニューヨーク時間の 8:30 発表になっている（夏時間の変換ミスを防ぐ）', () => {
        for (const e of bls) {
            const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })
                .format(toJstDate(e.date, e.time));
            expect(ny, `${e.date} ${e.event}`).toBe('08:30');
        }
    });

    it('ID が重複せず、日付が過去から未来へ並び、平日（米東部の日付）に当たる', () => {
        expect(new Set(ECONOMIC_EVENTS.map(e => e.id)).size).toBe(ECONOMIC_EVENTS.length);
        for (const e of bls) {
            const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(toJstDate(e.date, e.time));
            const dow = new Date(`${nyDate}T12:00:00Z`).getUTCDay();
            expect(dow, `${nyDate}`).toBeGreaterThanOrEqual(1);
            expect(dow, `${nyDate}`).toBeLessThanOrEqual(5);
        }
    });

    it('2027 年 6 月まで予定があり、期限切れチェック（45 日）に余裕がある', () => {
        const last = Math.max(...bls.map(e => toJstDate(e.date, e.time).getTime()));
        expect(last).toBeGreaterThan(Date.parse('2027-06-01T00:00:00+09:00'));
    });
});
