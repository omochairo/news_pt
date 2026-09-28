import { describe, expect, it } from 'vitest';
import { HISTORY_MAX_POINTS, MARKETS, REGIONS, formatChange, formatPrice, parseSparkResponse } from '../lib/world-markets';

describe('MARKETS', () => {
    it('シンボルに重複が無く、全銘柄の地域がタブに存在する', () => {
        const symbols = MARKETS.map(m => m.symbol);
        expect(new Set(symbols).size).toBe(symbols.length);
        const regions = new Set(REGIONS.map(r => r.id));
        expect(MARKETS.every(m => regions.has(m.region))).toBe(true);
    });
});

describe('parseSparkResponse', () => {
    it('前日終値と最後の終値から騰落を計算し、欠けた足を飛ばす', () => {
        const [q] = parseSparkResponse({
            '^N225': {
                timestamp: [1790553600, 1790553900, 1790554200],
                close: [100, null, 102],
                previousClose: 100,
                chartPreviousClose: 99,
            },
        });
        expect(q.symbol).toBe('^N225');
        expect(q.price).toBe(102);
        expect(q.change).toBe(2);
        expect(q.changePercent).toBeCloseTo(2);
        expect(q.history).toEqual([100, 102]);
        expect(q.lastTradeAt).toBe(new Date(1790554200 * 1000).toISOString());
    });

    it('previousClose が無ければ chartPreviousClose を使う', () => {
        const [q] = parseSparkResponse({ X: { timestamp: [1], close: [110], chartPreviousClose: 100 } });
        expect(q.changePercent).toBeCloseTo(10);
    });

    it('値が取れない銘柄・壊れた応答は捨てる', () => {
        expect(parseSparkResponse({ X: { close: [null], previousClose: 1 }, Y: { close: [1], previousClose: 0 }, Z: null })).toEqual([]);
        expect(parseSparkResponse('oops')).toEqual([]);
    });

    it('履歴は上限まで間引き、最後の点を残す', () => {
        const close = Array.from({ length: 300 }, (_, i) => i + 1);
        const [q] = parseSparkResponse({ X: { timestamp: close, close, previousClose: 1 } });
        expect(q.history).toHaveLength(HISTORY_MAX_POINTS);
        expect(q.history.at(-1)).toBe(300);
    });
});

describe('format', () => {
    it('桁数と単位', () => {
        expect(formatPrice(65877.624, {})).toBe('65,877.62');
        expect(formatPrice(5.1843, { decimals: 3, suffix: '%' })).toBe('5.184%');
        expect(formatPrice(13042976.4, { decimals: 0 })).toBe('13,042,976');
    });
    it('符号', () => {
        expect(formatChange(1.234, 2)).toBe('+1.23');
        expect(formatChange(-486.586, 2)).toBe('-486.59');
        expect(formatChange(0, 2)).toBe('±0.00');
    });
});
