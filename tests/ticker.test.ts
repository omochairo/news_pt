import { describe, expect, it } from 'vitest';
import { TICKER_SYMBOLS, toTickerData } from '../lib/market-data';
import { MARKETS, WorldQuote } from '../lib/world-markets';

const quote = (symbol: string, price: number, change: number): WorldQuote => ({
    symbol,
    price,
    previousClose: price - change,
    change,
    changePercent: (change / (price - change)) * 100,
    history: [price - change, price],
});

describe('ティッカー', () => {
    it('ティッカーの銘柄はすべて world-markets の取得対象に入っている', () => {
        const known = new Set(MARKETS.map(m => m.symbol));
        expect(TICKER_SYMBOLS.filter(t => !known.has(t.symbol))).toEqual([]);
    });

    it('world-markets の値をティッカーの形に直す', () => {
        const data = toTickerData({
            'JPY=X': quote('JPY=X', 150.1234, 0.5),
            'CL=F': quote('CL=F', 70, -1.4),
            'BTC-JPY': quote('BTC-JPY', 13192263.4, 0),
        });
        const by = Object.fromEntries(data.map(d => [d.name, d]));
        expect(data.map(d => d.name)).toEqual(TICKER_SYMBOLS.map(t => t.name));
        expect(by['USD/JPY']).toMatchObject({ price: '150.12', change: '+0.50', changePercent: '+0.33%', direction: 'up', history: [149.6234, 150.1234] });
        expect(by['原油WTI']).toMatchObject({ price: '$70.00', change: '-1.40', changePercent: '-1.96%', direction: 'down' });
        expect(by['BTC/JPY']).toMatchObject({ price: '13,192,263', direction: 'flat' });
    });

    it('取れていない銘柄は -- で返す', () => {
        const nikkei = toTickerData({}).find(d => d.name === '日経225');
        expect(nikkei).toMatchObject({ price: '--', change: '--', changePercent: '--', direction: 'flat', history: [] });
    });
});
