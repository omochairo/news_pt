import { describe, expect, it } from 'vitest';
import { DETAIL_MAX_POINTS, parseHistory } from '../lib/world-markets';

const t0 = 1790000000;

describe('parseHistory', () => {
    it('期間の騰落・高安を出し、欠けた足は飛ばす', () => {
        const h = parseHistory({ X: { timestamp: [t0, t0 + 60, t0 + 120, t0 + 180], close: [100, null, 120, 90] } }, 'X', '5d');
        expect(h).toMatchObject({ first: 100, last: 90, change: -10, high: 120, low: 90 });
        expect(h!.changePercent).toBeCloseTo(-10);
        expect(h!.points).toEqual([
            { t: new Date(t0 * 1000).toISOString(), v: 100 },
            { t: new Date((t0 + 120) * 1000).toISOString(), v: 120 },
            { t: new Date((t0 + 180) * 1000).toISOString(), v: 90 },
        ]);
    });

    it('点が多いときは間引くが、最初と最後の足は残す', () => {
        const n = 1000;
        const timestamp = Array.from({ length: n }, (_, i) => t0 + i * 60);
        const close = timestamp.map((_, i) => i + 1);
        const h = parseHistory({ X: { timestamp, close } }, 'X', '1y')!;
        expect(h.points.length).toBe(DETAIL_MAX_POINTS);
        expect(h.points[0].v).toBe(1);
        expect(h.points.at(-1)!.v).toBe(n);
        expect(h.high).toBe(n);
    });

    it('銘柄が無い・足が足りないときは null', () => {
        expect(parseHistory({}, 'X', '5d')).toBeNull();
        expect(parseHistory({ X: { timestamp: [t0], close: [1] } }, 'X', '5d')).toBeNull();
        expect(parseHistory(null, 'X', '5d')).toBeNull();
    });
});
