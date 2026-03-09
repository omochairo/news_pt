const axios = require('axios');
const cheerio = require('cheerio');

async function testGoogleNews() {
    const queries = [
        'site:bloomberg.co.jp+when:1d',
        'site:bloomberg.co.jp when:1d',
        'bloomberg.co.jp when:1d',
        'site:bloomberg.co.jp+when:24h',
        'bloomberg when:1d',
    ];

    for (const q of queries) {
        console.log(`\n--- Testing Query: ${q} ---`);
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`;
        try {
            const response = await axios.get(rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            const items = $('item');
            console.log(`Found ${items.length} items. URL: ${rssUrl}`);
            if (items.length > 0) {
                const firstTitle = items.first().find('title').text();
                const firstPubDate = items.first().find('pubDate').text();
                console.log(`First: ${firstTitle}`);
                console.log(`Date: ${firstPubDate}`);
            }
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

testGoogleNews();
