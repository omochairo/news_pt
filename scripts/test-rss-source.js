const axios = require('axios');
const cheerio = require('cheerio');

async function testSourceQuery() {
    const queries = [
        'source:"Bloomberg"',
        'source:"ブルームバーグ"',
    ];

    for (const q of queries) {
        console.log(`\n--- Testing: ${q} ---`);
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`;
        try {
            const response = await axios.get(rssUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            const items = $('item');
            console.log(`Found ${items.length} items.`);

            let validCount = 0;
            const now = new Date();

            items.each((_, element) => {
                const el = $(element);
                let title = el.find('title').text().trim();
                const pubDate = el.find('pubDate').text().trim();

                let diffHours = -1;
                if (pubDate) {
                    const d = new Date(pubDate);
                    diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
                }

                if (validCount < 5) {
                    console.log(`[${title.includes('Bloomberg') ? 'OK' : '??'}] [${diffHours.toFixed(1)}h ago] ${title}`);
                }
                validCount++;
            });

        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

testSourceQuery();
