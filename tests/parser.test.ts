import { describe, expect, it } from 'vitest';
import { isSafeHttpUrl, parseRssXml } from '../lib/parser';

describe('isSafeHttpUrl', () => {
    it('http / https だけを許す', () => {
        expect(isSafeHttpUrl('https://example.com/a')).toBe(true);
        expect(isSafeHttpUrl('http://example.com/a')).toBe(true);
        expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeHttpUrl('data:text/html,<p>x</p>')).toBe(false);
        expect(isSafeHttpUrl('not a url')).toBe(false);
    });
});

describe('parseRssXml', () => {
    const rss = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>日銀が金融政策決定会合の結果を公表</title><link>https://example.com/1</link><pubDate>Mon, 28 Sep 2026 01:00:00 GMT</pubDate></item>
  <item><title>悪意あるリンクを含む記事タイトル</title><link>javascript:alert(1)</link></item>
  <item><title>日銀が金融政策決定会合の結果を公表</title><link>https://example.com/dup</link></item>
</channel></rss>`;

    it('http(s) 以外のリンクと重複タイトルを除く', () => {
        const items = parseRssXml(rss, 'Nikkei');
        expect(items.map(i => i.url)).toEqual(['https://example.com/1']);
        expect(items[0].source).toBe('Nikkei');
        expect(items[0].isoDate).toBe('2026-09-28T01:00:00.000Z');
    });

    it('Atom の link[href] も読む', () => {
        const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>ビットコインが一時急伸した背景</title><link href="https://example.com/atom"/><updated>2026-09-28T00:00:00Z</updated></entry>
</feed>`;
        expect(parseRssXml(atom, 'Crypto').map(i => i.url)).toEqual(['https://example.com/atom']);
    });
});
