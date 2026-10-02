import { describe, expect, it } from 'vitest';
import { checkPaywall } from '../lib/paywall';
import type { NewsItem, NewsSource } from '../lib/parser';

const news = (source: NewsSource, title: string, url = 'https://example.com/x'): NewsItem => ({ source, title, url, time: '' });

describe('checkPaywall', () => {
    it('Bloomberg は全件有料', () => {
        expect(checkPaywall(news('Bloomberg', '円相場'))).toEqual({ isPaywall: true, label: '🔒 有料記事' });
    });

    it('日経は見出しの「有料・会員限定」と /article/ の記事を有料にする（/nkd/ は除く）', () => {
        expect(checkPaywall(news('Nikkei', '［有料会員限定］決算'))).toEqual({ isPaywall: true, label: '🔒 有料会員限定' });
        expect(checkPaywall(news('Nikkei', '会員限定の分析'))).toEqual({ isPaywall: true, label: '🔒 有料会員限定' });
        expect(checkPaywall(news('Nikkei', '東証', 'https://www.nikkei.com/article/DGX1/')).isPaywall).toBe(true);
        expect(checkPaywall(news('Nikkei', '東証', 'https://www.nikkei.com/nkd/article/x')).isPaywall).toBe(false);
    });

    it('他の媒体はキーワード（大文字小文字を問わない）で判定する', () => {
        expect(checkPaywall(news('Reuters', 'For Subscribers only'))).toEqual({ isPaywall: true, label: '🔒 有料記事' });
        expect(checkPaywall(news('CNN', 'Premium analysis')).isPaywall).toBe(true);
        expect(checkPaywall(news('Crypto', '購読者限定レポート')).isPaywall).toBe(true);
        expect(checkPaywall(news('Reuters', '米雇用統計'))).toEqual({ isPaywall: false, label: '' });
    });
});
