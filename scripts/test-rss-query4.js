const axios = require('axios');
const cheerio = require('cheerio');

async function testFix() {
    const q = 'site:bloomberg.co.jp when:1d';
    // Google News is very specific. Sometimes 'when:1d' needs to be space separated, NOT +.
    // Let's use standard URL encoding: encodeURIComponent(q)
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP:ja`;
    console.log('Fetching:', rssUrl);
    try {
        const response = await axios.get(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = $('item');
        console.log(`Found ${items.length} items.`);

        const MARKET_DATA_PATTERNS = [
            /Stock Price Quote/i,
            /\bQuote\s*[-–—]/i,
            /ETF Fund$/i,
            /Index Quote/i,
            /Bond Quote/i,
            /Futures Quote/i,
            /^\d{4}:/,
            /^[A-Z]{2,5}\s*Quote/i,
        ];

        let validCount = 0;
        const now = new Date();

        items.each((_, element) => {
            const el = $(element);
            let title = el.find('title').text().trim();
            const pubDate = el.find('pubDate').text().trim();

            title = title.replace(/\s*[-–—]\s*Bloomberg.*$/i, '').trim();

            if (MARKET_DATA_PATTERNS.some(p => p.test(title))) {
                // skip market data
                return;
            }

            let diffHours = -1;
            if (pubDate) {
                const d = new Date(pubDate);
                diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
                
                // Let's just print the first 10 strictly to see their ages!
                if (validCount < 10) {
                    console.log(`[${diffHours.toFixed(1)}h ago] ${title}`);
                }
                
                if (diffHours > 24) return;
            }

            validCount++;
        });

        console.log(`Total valid news articles (<=24h): ${validCount}`);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

testFix();
