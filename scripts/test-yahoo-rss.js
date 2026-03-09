const axios = require('axios');
const cheerio = require('cheerio');

async function testYahooRSS() {
    const rssUrl = 'https://news.yahoo.co.jp/rss/media/bloom_st/all.xml';
    console.log('Fetching:', rssUrl);
    try {
        const response = await axios.get(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = $('item');
        console.log(`Found ${items.length} items from Yahoo News Bloomberg.`);

        let validCount = 0;
        const now = new Date();

        items.each((_, element) => {
            const el = $(element);
            let title = el.find('title').text().trim();
            const link = el.find('link').text().trim();
            const pubDate = el.find('pubDate').text().trim();

            let diffHours = -1;
            if (pubDate) {
                const d = new Date(pubDate);
                diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
            }

            if (validCount < 10) {
                console.log(`[${diffHours.toFixed(1)}h ago] ${title} - ${link}`);
            }
            validCount++;
        });

    } catch (e) {
        console.log('Error:', e.message);
    }
}

testYahooRSS();
