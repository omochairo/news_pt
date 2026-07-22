import axios from 'axios';
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testCryptoFeeds() {
    const feeds = [
        { name: 'Google News Crypto', url: 'https://news.google.com/rss/search?q=%E6%9A%97%E5%8F%B7%E8%B3%87%E7%94%A3+OR+%E3%83%93%E3%83%83%E3%83%88%E3%82%B3%E3%82%A4%E3%83%B3+when:2d&hl=ja&gl=JP&ceid=JP:ja' },
        { name: 'CoinPost', url: 'https://coinpost.jp/?feed=rss2' },
        { name: 'CoinDesk Japan', url: 'https://www.coindeskjapan.com/feed/' },
    ];

    for (const f of feeds) {
        console.log(`\n========================================`);
        console.log(`Fetching ${f.name} -> ${f.url}`);
        console.log(`========================================`);
        try {
            const resp = await axios.get(f.url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: 8000,
            });
            const $ = cheerio.load(resp.data, { xmlMode: true });
            const items = $('item, entry');
            console.log(`Found ${items.length} items.`);
            items.slice(0, 5).each((i, el) => {
                const title = $(el).find('title').text().trim();
                const link = $(el).find('link').text().trim() || $(el).find('link').attr('href') || '';
                const date = $(el).find('pubDate').text().trim() || $(el).find('dc\\:date').text().trim();
                console.log(`  [${i + 1}] ${title}`);
                console.log(`      Date: ${date}`);
            });
        } catch (e: any) {
            console.error(`Error fetching ${f.name}:`, e.message);
        }
    }
}

testCryptoFeeds();
