import axios from 'axios';
import * as cheerio from 'cheerio';

async function testBloomberg() {
    const url = 'https://www.bloomberg.co.jp/';
    const resp = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            'Accept-Language': 'ja-JP,ja;q=0.9',
        }
    });

    const $ = cheerio.load(resp.data);
    let count = 0;
    
    // In Bloomberg, headlines are usually h3 or elements with 'headline' in class
    $('[class*="headline"], h3').each((i, el) => {
        const titleText = $(el).text().trim().replace(/\s+/g, ' ');
        if (!titleText || titleText.length < 10) return;

        // Find closest link
        const link = $(el).closest('a');
        let href = link.attr('href');
        
        // Sometimes the link is inside the headline, or the headline itself is a link
        if (!href) {
            const innerLink = $(el).find('a');
            href = innerLink.attr('href');
        }

        if (href && (href.includes('/news/articles/') || href.includes('/articles/')) && count < 10) {
            console.log(`\n--- Item ${count + 1} ---`);
            console.log('Title:', titleText);
            console.log('URL:', href);
            
            // Check for category text inside
            $(el).find('span').each((j, span) => {
                const sText = $(span).text().trim();
                if (sText && titleText.includes(sText) && sText !== titleText) {
                    console.log('Possible Category text:', sText);
                }
            });

            count++;
        }
    });
}

testBloomberg();
