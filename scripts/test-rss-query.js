const axios = require('axios');
const cheerio = require('cheerio');

async function testGoogleNews() {
    // ニュース記事URLに限定した検索クエリ + 株価ページを除外 + 直近1日間に限定
    const queries = [
        'site:bloomberg.co.jp/news/articles+-"Stock+Price+Quote"+-"Quote+-"+when:1d',
        'site:bloomberg.co.jp/news/articles+when:1d',
        'site:bloomberg.co.jp/news/articles when:1d',
        'site:bloomberg.co.jp/news/articles'
    ];

    for (const q of queries) {
        console.log(`\n--- Testing Query: ${q} ---`);
        const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=ja&gl=JP&ceid=JP:ja`;
        try {
            const response = await axios.get(rssUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                },
                timeout: 10000,
            });
            const $ = cheerio.load(response.data, { xmlMode: true });
            const items = $('item');
            console.log(`Found ${items.length} items.`);
            if (items.length > 0) {
                const firstPubDate = items.first().find('pubDate').text();
                // 最初の記事をDateパースしてみる
                const d = new Date(firstPubDate);
                const now = new Date();
                const diffHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
                console.log(`First item pubDate: ${firstPubDate} (parsed: ${d.toISOString()})`);
                console.log(`Age: ${diffHours.toFixed(1)} hours ago`);
            }
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

testGoogleNews();
