const axios = require('axios');
const cheerio = require('cheerio');

async function testRdf() {
    const urls = [
        'https://assets.wor.jp/rss/rdf/bloomberg/latest.rdf',
        'https://assets.wor.jp/rss/rdf/bloomberg/markets.rdf',
        'https://assets.wor.jp/rss/rdf/bloomberg/finance.rdf',
        'https://assets.wor.jp/rss/rdf/bloomberg/economics.rdf',
        'https://assets.wor.jp/rss/rdf/nikkei/markets.rdf',
        'https://assets.wor.jp/rss/rdf/nikkei/economy.rdf',
        'https://assets.wor.jp/rss/rdf/sankei/economy.rdf',
        'https://assets.wor.jp/rss/rdf/ynnews/economics.rdf'
    ];

    for (const u of urls) {
        try {
            const resp = await axios.get(u, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                timeout: 8000,
            });
            const $ = cheerio.load(resp.data, { xmlMode: true });
            const items = $('item');
            console.log(`[${items.length} items] ${u}`);
            if (items.length > 0) {
                const firstTitle = $(items[0]).find('title').text();
                const firstDate = $(items[0]).find('dc\\:date').text() || $(items[0]).find('date').text() || $(items[0]).find('pubDate').text();
                console.log(`   Sample: ${firstTitle} (${firstDate})`);
            }
        } catch (e) {
            console.error(`Error fetching ${u}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 500));
    }
}

testRdf();
