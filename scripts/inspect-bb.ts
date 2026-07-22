import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function inspectBloomberg() {
    const queries = [
        'site:bloomberg.co.jp when:2d',
        'site:bloomberg.co.jp/news when:2d',
        'site:bloomberg.co.jp/news/articles/ when:2d',
        'ブルームバーグ when:2d',
    ];

    for (const q of queries) {
        console.log(`\n========================================`);
        console.log(`Query: ${q}`);
        console.log(`========================================`);
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`;
        try {
            const resp = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
            const $ = cheerio.load(resp.data, { xmlMode: true });
            const items = $('item');
            console.log(`Found ${items.length} items.`);
            items.slice(0, 15).each((i, el) => {
                const title = $(el).find('title').text().trim();
                const link = $(el).find('link').text().trim();
                console.log(`[${i + 1}] ${title}`);
            });
        } catch (e: any) {
            console.error(`Error:`, e.message);
        }
    }
}

inspectBloomberg();
