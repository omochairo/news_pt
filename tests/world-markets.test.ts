import { describe, expect, it } from 'vitest';
import { HISTORY_MAX_POINTS, MARKETS, REGIONS, formatChange, formatPrice, getMarketStatus, parseSparkResponse } from '../lib/world-markets';

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

    it('取引開始前で当日の足が無いときは直前の取引日の終値を使う', () => {
        // ボベスパの実データの形
        const [q] = parseSparkResponse({
            '^BVSP': { timestamp: [], close: null, start: null, end: null, previousClose: 183966, fulldayPrice: 183476.86 },
        });
        expect(q.price).toBe(183476.86);
        expect(q.changePercent).toBeCloseTo(-0.266, 3);
        expect(q.history).toEqual([]);
        expect(q.lastTradeAt).toBeUndefined();
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

describe('取引時間', () => {
    it('spark の start / end を取引時間として取り込む', () => {
        const [q] = parseSparkResponse({ X: { timestamp: [1790554200], close: [1], previousClose: 1, start: 1790553600, end: 1790577000 } });
        expect(q.sessionStart).toBe(new Date(1790553600 * 1000).toISOString());
        expect(q.sessionEnd).toBe(new Date(1790577000 * 1000).toISOString());
    });

    // 日経の実データの形（9:00〜15:30 JST）
    const nikkei = {
        sessionStart: '2026-09-28T00:00:00.000Z',
        sessionEnd: '2026-09-28T06:30:00.000Z',
        lastTradeAt: '2026-09-28T02:00:00.000Z',
    };

    it('取引時間内で最近まで値が付いていれば取引中', () => {
        expect(getMarketStatus(nikkei, new Date('2026-09-28T02:10:00Z'))).toBe('open');
    });

    it('取引時間外は時間外', () => {
        expect(getMarketStatus({ ...nikkei, lastTradeAt: '2026-09-28T06:30:00.000Z' }, new Date('2026-09-28T13:00:00Z'))).toBe('closed');
    });

    it('取引時間内でも値が 30 分以上止まっていれば時間外（昼休みなど）', () => {
        expect(getMarketStatus(nikkei, new Date('2026-09-28T02:31:00Z'))).toBe('closed');
    });

    it('取引時間が分からなければ時間外', () => {
        expect(getMarketStatus({ lastTradeAt: nikkei.lastTradeAt }, new Date('2026-09-28T02:10:00Z'))).toBe('closed');
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
