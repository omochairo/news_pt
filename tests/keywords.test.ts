import { describe, expect, it } from 'vitest';
import { extractTrendKeywords } from '../lib/keywords';
import { categorizeArticle, getCategoryConfig } from '../lib/categorizer';
import { scoreImportance } from '../lib/importance';
import { detectRelatedSymbol } from '../lib/market-data';
import type { NewsItem } from '../lib/parser';

const n = (title: string): NewsItem => ({ title, url: title, source: 'Nikkei', time: '' });

describe('extractTrendKeywords', () => {
    it('重要語は 2 点、その他の語は 1 点で数え、2 点以上を多い順に返す', () => {
        const items = [n('日銀が利上げを決定 トヨタ自動車'), n('日銀の総裁会見 トヨタ自動車'), n('マイクロソフト決算')];
        const keywords = extractTrendKeywords(items);
        expect(keywords[0]).toEqual({ word: '日銀', count: 4 });
        // カタカナと漢字は別の語として切り出す
        expect(keywords).toContainEqual({ word: 'トヨタ', count: 2 });
        expect(keywords).toContainEqual({ word: '自動車', count: 2 });
        expect(keywords.find(k => k.word === 'マイクロソフト')).toBeUndefined(); // 1 回だけ
    });

    it('ストップワード・数字は数えず、件数を limit で切る', () => {
        const items = [n('ロイター 速報 2026 ニュース'), n('ロイター 速報 2026 ニュース')];
        expect(extractTrendKeywords(items)).toEqual([]);
        const many = [n('円安 円高 ドル高 ドル安'), n('円安 円高 ドル高 ドル安')];
        expect(extractTrendKeywords(many, 2)).toHaveLength(2);
    });
});

describe('分類・重要度・関連銘柄', () => {
    it('categorizeArticle: どれにも当たらなければ all、getCategoryConfig は未知の ID で all', () => {
        expect(categorizeArticle('新型スマートフォンを発表')).toBe('all');
        expect(getCategoryConfig('fx').id).toBe('fx');
        expect(getCategoryConfig('nope' as never).id).toBe('all');
    });

    it('scoreImportance: 重要語が無ければ normal', () => {
        expect(scoreImportance('新型スマートフォンを発表')).toBe('normal');
    });

    it('detectRelatedSymbol: 暗号資産を為替より先に判定し、当てはまらなければ null', () => {
        expect(detectRelatedSymbol('ビットコインが3億ドルの流入')).toBe('BTC/JPY');
        expect(detectRelatedSymbol('円安が進行')).toBe('USD/JPY');
        expect(detectRelatedSymbol('ユーロ円が上昇')).toBe('EUR/JPY');
        expect(detectRelatedSymbol('日経平均が反発')).toBe('日経225');
        expect(detectRelatedSymbol('ナスダックが最高値')).toBe('S&P 500');
        expect(detectRelatedSymbol('OPECが減産')).toBe('原油WTI');
        expect(detectRelatedSymbol('新型スマートフォンを発表')).toBeNull();
    });

    it('detectRelatedSymbol: 株価の値幅の「円高」や「ハードル高い」を為替にしない', () => {
        expect(detectRelatedSymbol('日経平均、一時1000円高')).toBe('日経225');
        expect(detectRelatedSymbol('日本株が反発、５００円高')).toBe('日経225');
        expect(detectRelatedSymbol('利上げのハードル高い')).toBeNull();
        expect(detectRelatedSymbol('円高が進み、日経平均は反落')).toBe('USD/JPY');
    });
});
