const axios = require('axios');
const cheerio = require('cheerio');

async function testGoogleFinance() {
    const url = 'https://www.google.com/finance/quote/USD-JPY';
    const resp = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    
    const $ = cheerio.load(resp.data);
    
    const priceEl = $('[data-last-price]');
    console.log('data-last-price found:', priceEl.length > 0);
    
    const priceText = $('[class*="YMlKec fxKbKc"]').first().text().replace(/[,¥$€£]/g, '');
    console.log('priceText:', priceText);
    
    const changeText = $('[class*="JwB6zf"]').first().text();
    console.log('changeText:', changeText);
}

testGoogleFinance();
