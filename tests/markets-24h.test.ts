import { describe, expect, it } from 'vitest';
import { MARKETS, parse24h } from '../lib/world-markets';

const H = 3600;

describe('24時間ビューの対象', () => {
    it('24時間取引の銘柄は spark の 1 リクエスト（20 銘柄）に収まる', () => {
        const n = MARKETS.filter(m => m.h24).length;
        expect(n).toBeGreaterThan(0);
        expect(n).toBeLessThanOrEqual(20);
    });
});

describe('parse24h', () => {
    it('最後の足から 24 時間前の値を起点に騰落・高安・幅を出す', () => {
        // 30 時間分の 1 時間足。値は 100 + 経過時間
        const t0 = 1790000000;
        const timestamp = Array.from({ length: 31 }, (_, i) => t0 + i * H);
        const close = timestamp.map((_, i) => 100 + i);
        const [q] = parse24h({ X: { timestamp, close } });
        expect(q.price).toBe(130);
        expect(q.base).toBe(106); // 最後の足（+30h）の 24 時間前 = +6h
        expect(q.changePercent).toBeCloseTo((24 / 106) * 100);
        expect(q.high).toBe(130);
        expect(q.low).toBe(106);
        expect(q.from).toBe(new Date((t0 + 6 * H) * 1000).toISOString());
        expect(q.to).toBe(new Date((t0 + 30 * H) * 1000).toISOString());
    });

    it('ちょうど 24 時間前の足が無ければ、それ以前で最も新しい足を起点にする', () => {
        const t0 = 1790000000;
        // 週末の空白: 金曜の足のあと 48 時間飛んで月曜
        const timestamp = [t0, t0 + H, t0 + 50 * H, t0 + 51 * H];
        const close = [100, 101, 110, 111];
        const [q] = parse24h({ X: { timestamp, close } });
        expect(q.base).toBe(101);
        expect(q.price).toBe(111);
    });

    it('足が足りない・欠けた値は捨てる', () => {
        expect(parse24h({ X: { timestamp: [1], close: [1] } })).toEqual([]);
        const [q] = parse24h({ X: { timestamp: [1, 2, 3], close: [100, null, 110] } });
        expect(q.history).toEqual([100, 110]);
        expect(parse24h(null)).toEqual([]);
    });
});
