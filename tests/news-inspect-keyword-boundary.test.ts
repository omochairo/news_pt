import { describe, expect, it } from 'vitest';
import { categorizeArticle } from '@/lib/categorizer';
import { scoreImportance } from '@/lib/importance';
import { extractTrendKeywords } from '@/lib/keywords';

describe('英字キーワードの語境界', () => {
    it('Boeing / offered / Chipotle を重要度 HIGH にしない（BOE・Fed・IPO の部分一致）', () => {
        expect(scoreImportance('Boeing delivers new planes')).toBe('normal');
        expect(scoreImportance('Company offered new plan')).toBe('normal');
        expect(scoreImportance('Chipotle opens stores')).toBe('normal');
        // 本物は従来どおり
        expect(scoreImportance('Fed holds rates')).toBe('high');
        expect(scoreImportance('Fed\'s Powell speaks')).toBe('high');
        expect(scoreImportance('IPO ラッシュ')).toBe('high');
    });

    it('solar / method / Netherlands を暗号資産に分類しない（SOL・ETH の部分一致）', () => {
        expect(categorizeArticle('Solar power demand grows')).toBe('all');
        expect(categorizeArticle('New method announced')).toBe('all');
        expect(categorizeArticle('SOL surges')).toBe('crypto');
        expect(categorizeArticle('Bitcoin hits record')).toBe('crypto');
    });

    it('AIG を優先語 AI として数えない', () => {
        const kws = extractTrendKeywords([{ title: 'AIGが増益', url: 'a', source: 'Nikkei', time: '' }, { title: 'AIG決算', url: 'b', source: 'Nikkei', time: '' }]);
        expect(kws.map(k => k.word)).not.toContain('AI');
    });
});
