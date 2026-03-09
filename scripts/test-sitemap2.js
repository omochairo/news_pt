const axios = require('axios');
const cheerio = require('cheerio');

async function testBloombergSitemaps() {
    const urls = [
        'https://www.bloomberg.co.jp/feeds/cojp/sitemap_recent.xml',
        'https://www.bloomberg.co.jp/feeds/cojp/sitemap_news.xml'
    ];

    for (const url of urls) {
        console.log(`\n--- Fetching: ${url} ---`);
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            const urlsObj = $('url');
            console.log(`Found ${urlsObj.length} URLs in sitemap`);

            const now = new Date();
            let validCount = 0;

            urlsObj.each((_, el) => {
                const loc = $(el).find('loc').text();
                // sitemap_news.xml uses <news:news><news:title> and <news:publication_date>
                const title = $(el).find('news\\:title').text() || $(el).find('title').text() || 'No Title';
                const dateStr = $(el).find('news\\:publication_date').text() || $(el).find('lastmod').text();

                let diffHours = -1;
                if (dateStr) {
                    const d = new Date(dateStr);
                    diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
                }

                if (validCount < 5) {
                    console.log(`[${diffHours.toFixed(1)}h ago] ${title}`);
                }
                validCount++;
            });

        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}

testBloombergSitemaps();
