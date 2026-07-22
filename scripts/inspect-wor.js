const axios = require('axios');

async function run() {
    try {
        const url = 'https://assets.wor.jp/rss/db/frontend/categories.json';
        const resp = await axios.get(url);
        const categories = resp.data;

        for (const cat of categories) {
            console.log(`\n============================`);
            console.log(`Category: ${cat.name} (${cat.label})`);
            console.log(`============================`);
            for (const site of cat.sites || []) {
                console.log(`  Site: ${site.name} (${site.label}) - ${site.url}`);
                for (const feed of site.feeds || []) {
                    const rdfUrl = `https://assets.wor.jp/rss/rdf/${site.label}/${feed.label}.rdf`;
                    console.log(`    Feed: [${feed.name}] -> ${rdfUrl}`);
                }
            }
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
