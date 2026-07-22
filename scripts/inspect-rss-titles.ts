import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function inspectFeed(query: string, label: string) {
    console.log(`\n========================================`);
    console.log(`Fetching RSS for ${label} (Query: ${query})`);
    console.log(`========================================`);

    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
    try {
        const resp = await axios.get(url, { headers: { 'User-Agent': USER_AGENT } });
        const $ = cheerio.load(resp.data, { xmlMode: true });
        const items = $('item');

        items.each((i, el) => {
            const title = $(el).find('title').text().trim();
            const link = $(el).find('link').text().trim();
            console.log(`[${i + 1}] ${title}`);
            console.log(`    URL: ${link}`);
        });
    } catch (e: any) {
        console.error(`Error:`, e.message);
    }
}

async function run() {
    await inspectFeed('site:bloomberg.co.jp when:2d', 'Bloomberg (site:bloomberg.co.jp)');
    await inspectFeed('site:jp.reuters.com when:2d', 'Reuters (site:jp.reuters.com)');
}

run();
