import { describe, expect, it } from 'vitest';
import { categorizeArticle } from '@/lib/categorizer';
import { checkPaywall } from '@/lib/paywall';
import { detectRelatedMarkets } from '@/lib/related-news';
import { parseRssXml } from '@/lib/parser';

describe('Issue #55: ニュース取得・解析', () => {
    it('Atom で rel="self" が先にあっても記事の URL（alternate）を取る', () => {
        const xml = '<feed><entry><title>テスト見出しですよ</title><link rel="self" href="https://a/self"/><link rel="alternate" href="https://a/real"/><updated>2024-05-01T10:00:00Z</updated></entry></feed>';
        expect(parseRssXml(xml, 'X' as never).map(i => i.url)).toEqual(['https://a/real']);
    });

    it('RSS の <link> 本文はそのまま使う', () => {
        const xml = '<rss><channel><item><title>テスト見出しですよね</title><link>https://a/2</link><pubDate>Mon, 01 May 2024 10:00:00 GMT</pubDate></item></channel></rss>';
        expect(parseRssXml(xml, 'X' as never).map(i => i.url)).toEqual(['https://a/2']);
    });

    it('「資金」「日銀」「金曜」をコモディティにしない。金・銀そのものは従来どおり', () => {
        expect(categorizeArticle('メガバンクが資金調達')).not.toBe('commodities');
        expect(categorizeArticle('日銀が金利据え置き')).toBe('bonds');
        expect(categorizeArticle('金曜の夜に会見')).not.toBe('commodities');
        expect(categorizeArticle('金が最高値を更新')).toBe('commodities');
        expect(categorizeArticle('銀が急伸')).toBe('commodities');
    });

    it('「有料道路」は有料記事にしない。「有料」の記事は従来どおり', () => {
        const base = { source: 'CNN', url: 'https://x/', time: '' } as never;
        expect(checkPaywall({ ...(base as object), title: '有料道路の料金改定' } as never).isPaywall).toBe(false);
        expect(checkPaywall({ ...(base as object), title: '【有料】相場の読み方' } as never).isPaywall).toBe(true);
    });

    it('「独自」を含む見出しでも長期金利は日本国債と関連づける。「独長期金利」は別', () => {
        const syms = (t: string) => detectRelatedMarkets(t);
        expect(syms('長期金利、独自要因で上昇')).toContain('JGB10Y');
        expect(syms('独長期金利が上昇')).not.toContain('JGB10Y');
    });

});
