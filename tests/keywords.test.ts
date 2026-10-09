import { describe, expect, it } from 'vitest';
import { extractTrendKeywords } from '../lib/keywords';
import { categorizeArticle, getCategoryConfig } from '../lib/categorizer';
import { scoreImportance } from '../lib/importance';
import { detectPrimaryMarket } from '../lib/related-news';
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

    it('detectPrimaryMarket: 暗号資産を為替より先に判定し、当てはまらなければ null', () => {
        expect(detectPrimaryMarket('ビットコインが3億ドルの流入')).toBe('BTC-JPY');
        expect(detectPrimaryMarket('円安が進行')).toBe('JPY=X');
        expect(detectPrimaryMarket('ユーロ円が上昇')).toBe('EURJPY=X');
        expect(detectPrimaryMarket('日経平均が反発')).toBe('^N225');
        expect(detectPrimaryMarket('ナスダックが最高値')).toBe('^IXIC');
        expect(detectPrimaryMarket('OPECが減産')).toBe('CL=F');
        expect(detectPrimaryMarket('新型スマートフォンを発表')).toBeNull();
    });

    it('detectPrimaryMarket: 暗号資産は記事の通貨のチャートを出し、通貨名が無ければビットコインを出す', () => {
        expect(detectPrimaryMarket('イーサリアムが急伸、ETF承認期待')).toBe('ETH-JPY');
        expect(detectPrimaryMarket('暗号資産市場でイーサリアムが急落')).toBe('ETH-JPY');
        expect(detectPrimaryMarket('仮想通貨XRPが反発、リップル社の訴訟終結で')).toBe('XRP-JPY');
        expect(detectPrimaryMarket('ソラナ（SOL）、ETF申請が相次ぐ')).toBe('SOL-JPY');
        expect(detectPrimaryMarket('Solana network outage')).toBe('SOL-JPY');
        expect(detectPrimaryMarket('ビットコインとイーサリアムがそろって下落')).toBe('BTC-JPY');
        expect(detectPrimaryMarket('イーサリアム、ビットコイン比で最安値')).toBe('ETH-JPY');
        expect(detectPrimaryMarket('金融庁、暗号資産交換業者に報告命令')).toBe('BTC-JPY');
        expect(detectPrimaryMarket('EU当局、未認可ステーブルコインを排除へ')).toBe('BTC-JPY');
        // 波及効果の「リップル効果」、政府効率化の「日本版DOGE」は暗号資産ではない
        expect(detectPrimaryMarket('利上げのリップル効果が広がる')).toBeNull();
        expect(detectPrimaryMarket('日本版DOGE、EVやメタボ補助も争点')).toBeNull();
    });

    it('detectPrimaryMarket: 株価の値幅の「円高」や「ハードル高い」を為替にしない', () => {
        expect(detectPrimaryMarket('日経平均、一時1000円高')).toBe('^N225');
        expect(detectPrimaryMarket('日本株が反発、５００円高')).toBe('^N225');
        expect(detectPrimaryMarket('利上げのハードル高い')).toBeNull();
        expect(detectPrimaryMarket('円高が進み、日経平均は反落')).toBe('JPY=X');
    });

    it('detectPrimaryMarket: 主要 6 銘柄以外のチャートも出す', () => {
        expect(detectPrimaryMarket('恐怖指数VIXが急上昇')).toBe('^VIX');
        expect(detectPrimaryMarket('金価格が最高値を更新')).toBe('GC=F');
        expect(detectPrimaryMarket('米長期金利が上昇')).toBe('^TNX');
        expect(detectPrimaryMarket('長期金利が1.8%に上昇')).toBe('JGB10Y');
        expect(detectPrimaryMarket('香港株が大幅安')).toBe('^HSI');
        expect(detectPrimaryMarket('欧州株　英ＦＴ指数は続落、独ＤＡＸ指数は続伸')).toBe('^STOXX50E');
        expect(detectPrimaryMarket('独ＤＡＸ指数が最高値')).toBe('^GDAXI');
        expect(detectPrimaryMarket('ブラジル株が反発')).toBe('^BVSP');
        expect(detectPrimaryMarket('イーサリアムが急伸')).toBe('ETH-JPY');
        expect(detectPrimaryMarket('豪S&P/ASX200指数は8758.03で取引終了')).toBe('^AORD');
        expect(detectPrimaryMarket('加S&P/TSX総合指数が続伸')).toBe('^GSPTSE');
        expect(detectPrimaryMarket('米S&P500が最高値')).toBe('^GSPC');
    });

    it('detectPrimaryMarket: 銘柄名が無くても、企業名・中銀・地政学から引く。銘柄名があればそちらを優先する', () => {
        expect(detectPrimaryMarket('FOMC、利下げを決定')).toBe('^TNX');
        expect(detectPrimaryMarket('日銀が利上げを決定')).toBe('JPY=X');
        expect(detectPrimaryMarket('トヨタが過去最高益')).toBe('^N225');
        expect(detectPrimaryMarket('テスラの販売台数が減少')).toBe('^NYFANG');
        expect(detectPrimaryMarket('TSMCが増産')).toBe('^TWII');
        expect(detectPrimaryMarket('イラン情勢が緊迫')).toBe('CL=F');
        expect(detectPrimaryMarket('ECB、政策金利を据え置き')).toBe('EURUSD=X');
        expect(detectPrimaryMarket('トヨタ株高で日経平均が続伸')).toBe('^N225');
        expect(detectPrimaryMarket('エヌビディア決算で半導体株が高い')).toBe('^SOX');
        expect(detectPrimaryMarket('NYダウ反落、米国株は全面安')).toBe('^DJI');
        expect(detectPrimaryMarket('香港株寄り付き　反発で始まる、米金利低下が支え')).toBe('^HSI');
    });

    it('detectPrimaryMarket: 「株価」は他国の名前が無いときだけ日本株にする', () => {
        expect(detectPrimaryMarket('株価が乱高下')).toBe('^N225');
        expect(detectPrimaryMarket('中国の株価が下落')).toBeNull();
    });
});
