import { describe, expect, it } from 'vitest';
import { HealthInput, evaluateHealth } from '../lib/health';

const at = '2026-10-01T00:00:00.000Z';
const healthy: HealthInput = {
    world: { lastFetch: { at, count: 53 }, expected: 53 },
    h24: { lastFetch: { at, count: 16 }, expected: 16 },
    news: { counts: { nikkei: 30, reuters: 30 }, stale: false },
};

describe('evaluateHealth', () => {
    it('すべて取れていれば ok', () => {
        expect(evaluateHealth(healthy)).toEqual({ ok: true, problems: [] });
    });

    it('相場は 8 割までの欠けを許す', () => {
        expect(evaluateHealth({ ...healthy, world: { lastFetch: { at, count: 43 }, expected: 53 } }).ok).toBe(true);
        const r = evaluateHealth({ ...healthy, world: { lastFetch: { at, count: 42 }, expected: 53 } });
        expect(r.ok).toBe(false);
        expect(r.problems).toEqual(['world-markets: 直近の取得が 42/53 件（43 件未満）']);
    });

    it('相場が全滅・未取得なら異常', () => {
        const r = evaluateHealth({ ...healthy, h24: { lastFetch: { at, count: 0 }, expected: 16 }, world: { lastFetch: null, expected: 53 } });
        expect(r.problems).toEqual(['world-markets: 一度も取得していない', 'world-markets/24h: 直近の取得が 0/16 件（13 件未満）']);
    });

    it('ニュースは媒体ごとに 0 件・取得失敗・古いキャッシュを異常にする', () => {
        expect(evaluateHealth({ ...healthy, news: { counts: { nikkei: 0, reuters: 3 }, stale: false } }).problems).toEqual(['news/nikkei: 0 件']);
        expect(evaluateHealth({ ...healthy, news: { counts: { nikkei: 1 }, stale: true } }).problems).toEqual(['news: 取得に失敗し、古いキャッシュを返している']);
        expect(evaluateHealth({ ...healthy, news: null }).problems).toEqual(['news: 取得できない']);
    });

    it('前回の記事を表示していても、0 件が 30 分以上続いた媒体は異常にする', () => {
        const now = Date.parse(at);
        const news = (since: string) => ({ counts: { nikkei: 30, reuters: 30 }, stale: false, emptySince: { reuters: since } });
        expect(evaluateHealth({ ...healthy, news: news('2026-09-30T23:31:00.000Z') }, now).ok).toBe(true);
        expect(evaluateHealth({ ...healthy, news: news('2026-09-30T23:30:00.000Z') }, now).problems)
            .toEqual(['news/reuters: 30 分取れていない（前回の記事を表示中）']);
        // 前回の記事も無ければ、従来どおり「0 件」だけを出す
        expect(evaluateHealth({ ...healthy, news: { counts: { nikkei: 30, reuters: 0 }, stale: false, emptySince: { reuters: '2026-09-30T20:00:00.000Z' } } }, now).problems)
            .toEqual(['news/reuters: 0 件']);
    });
});
