import { describe, expect, it } from 'vitest';
import { RELATED_SYMBOLS, detectRelatedMarkets, pickRelatedNews } from '../lib/related-news';
import { MARKETS } from '../lib/world-markets';

describe('detectRelatedMarkets', () => {
    it('対応表の銘柄はすべて world-markets の銘柄', () => {
        const known = new Set(MARKETS.map(m => m.symbol));
        expect([...RELATED_SYMBOLS].filter(s => !known.has(s))).toEqual([]);
    });

    it('見出しに当てはまる銘柄を全部返す', () => {
        expect(detectRelatedMarkets('日経平均が反発、円安が追い風')).toEqual(['^N225', 'NIY=F', 'JPY=X']);
        expect(detectRelatedMarkets('Dow, Nasdaq slip as Treasury yields rise')).toEqual(['^DJI', 'YM=F', '^IXIC', 'NQ=F', '^TNX']);
        expect(detectRelatedMarkets('暗号資産市場でビットコインが急落')).toEqual(['BTC-JPY', 'ETH-JPY']);
        expect(detectRelatedMarkets('Gold hits record as oil falls')).toEqual(['GC=F', 'CL=F']);
    });

    it('英字は単語の境界で判定する', () => {
        expect(detectRelatedMarkets('Goldman Sachs raises target')).toEqual([]);
        expect(detectRelatedMarkets('FRAUD probe widens')).toEqual([]);
        expect(detectRelatedMarkets('AUD and GBP rally')).toEqual(['GBPJPY=X', 'AUDJPY=X']);
        expect(detectRelatedMarkets('Boiling point for tech')).toEqual([]);
    });

    it('株価の値幅の「◯円高」は円相場にしない', () => {
        expect(detectRelatedMarkets('日経平均終値2203円高　6万8956円')).toEqual(['^N225', 'NIY=F']);
        expect(detectRelatedMarkets('東京株式（大引け）＝２２０３円高')).toEqual(['^N225', 'NIY=F']);
        expect(detectRelatedMarkets('外為14時　円高が進む')).toEqual(['JPY=X']);
    });

    it('全角英字の指数名も拾う', () => {
        expect(detectRelatedMarkets('欧州株　英ＦＴ指数は１．０５％安、独ＤＡＸ指数は０．６０％安')).toEqual(['^FTSE', '^GDAXI', '^STOXX50E']);
    });

    it('関係のない見出しは空', () => {
        expect(detectRelatedMarkets('新型スマートフォンを発表')).toEqual([]);
    });
});

describe('pickRelatedNews', () => {
    const items = [
        { title: '円安が進行', url: 'a' },
        { title: '新製品を発表', url: 'b' },
        { title: 'ドル円 150円台', url: 'c' },
        { title: '円安が進行', url: 'a' },
        { title: 'ドル高続く', url: 'd' },
    ];

    it('並びのまま、関係する記事だけを重複なしで上限まで返す', () => {
        expect(pickRelatedNews(items, 'JPY=X').map(i => i.url)).toEqual(['a', 'c', 'd']);
        expect(pickRelatedNews(items, 'JPY=X', 2).map(i => i.url)).toEqual(['a', 'c']);
        expect(pickRelatedNews(items, '^N225')).toEqual([]);
    });
});
