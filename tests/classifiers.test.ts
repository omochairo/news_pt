import { describe, expect, it } from 'vitest';
import { categorizeArticle } from '../lib/categorizer';
import { scoreImportance } from '../lib/importance';
import { checkPaywall } from '../lib/paywall';

describe('categorizeArticle', () => {
    it('どのキーワードにも当たらなければ all', () => {
        expect(categorizeArticle('週末の天気のまとめ')).toBe('all');
    });
    it('暗号資産の記事は crypto', () => {
        expect(categorizeArticle('ビットコインが反発')).toBe('crypto');
    });
});

describe('scoreImportance', () => {
    it('速報キーワードは breaking', () => {
        expect(scoreImportance('【速報】日経平均が急落')).toBe('breaking');
    });
    it('キーワードが無ければ normal', () => {
        expect(scoreImportance('週末の天気のまとめ')).toBe('normal');
    });
});

describe('checkPaywall', () => {
    it('Bloomberg は有料扱い', () => {
        const info = checkPaywall({ title: 'x', url: 'https://www.bloomberg.co.jp/news/articles/x', source: 'Bloomberg', time: '' });
        expect(info.isPaywall).toBe(true);
    });
});
