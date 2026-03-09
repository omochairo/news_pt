const axios = require('axios');
const cheerio = require('cheerio');

async function testBloombergRSS() {
    // Bloomberg Sitemap News
    console.log('\n--- Bloomberg Sitemap News ---');
    try {
        const resp = await axios.get('https://www.bloomberg.co.jp/feeds/sitemap_news.xml', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
            timeout: 10000,
        });
        console.log('Status:', resp.status);
        const $ = cheerio.load(resp.data, { xmlMode: true });
        const urls = $('url');
        console.log('Found', urls.length, 'URLs');
        urls.slice(0, 5).each((i, el) => {
            const title = $(el).find('news\\:title').text() || $(el).find('title').text();
            const loc = $(el).find('loc').text();
            console.log('  Title:', title);
            console.log('  URL:', loc);
        });
    } catch (e) {
        console.log('Error:', e.message, '(status:', e.response?.status, ')');
    }

    // Google News RSS
    console.log('\n--- Google News RSS for Bloomberg Japan ---');
    try {
        const resp = await axios.get('https://news.google.com/rss/search?q=site:bloomberg.co.jp&hl=ja&gl=JP&ceid=JP:ja', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        console.log('Status:', resp.status);
        const $ = cheerio.load(resp.data, { xmlMode: true });
        const items = $('item');
        console.log('Found', items.length, 'items');
        items.slice(0, 5).each((i, el) => {
            console.log('  Title:', $(el).find('title').text());
            console.log('  Link:', $(el).find('link').text());
        });
    } catch (e) {
        console.log('Error:', e.message);
    }

    // Bloomberg RSS feed
    console.log('\n--- Bloomberg Global RSS ---');
    try {
        const resp = await axios.get('https://feeds.bloomberg.com/markets/news.rss', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        console.log('Status:', resp.status);
        console.log('First 300 chars:', resp.data.substring(0, 300));
    } catch (e) {
        console.log('Error:', e.message, '(status:', e.response?.status, ')');
    }
}

testBloombergRSS();
