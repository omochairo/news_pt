const axios = require('axios');
const cheerio = require('cheerio');

async function testBloombergSitemap() {
    try {
        // 1. Fetch the sitemap index
        const indexUrl = 'https://www.bloomberg.co.jp/feeds/cojp/sitemap_index.xml';
        console.log(`Fetching index: ${indexUrl}`);
        const indexResp = await axios.get(indexUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
            timeout: 10000,
        });
        
        const $1 = cheerio.load(indexResp.data, { xmlMode: true });
        
        // Find recent news sitemaps
        const sitemaps = [];
        $1('sitemap loc').each((_, el) => {
            const num = $1(el).text();
            if (num.includes('sitemap_news')) {
                sitemaps.push(num);
            }
        });
        
        console.log(`Found ${sitemaps.length} news sitemaps, using the first one: ${sitemaps[0] || 'none'}`);
        
        // Let's use sitemap_news.xml directly which was reported 404 earlier, maybe it's sitemap_recent.xml? 
        // Let's print all sitemap URLs
        $1('sitemap loc').slice(0, 5).each((_, el) => {
            console.log($1(el).text());
        });

    } catch (e) {
        console.log(`Error fetching index: ${e.message}`);
    }
}

testBloombergSitemap();
