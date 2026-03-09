const axios = require('axios');

async function checkRobots() {
    try {
        const response = await axios.get('https://www.bloomberg.co.jp/robots.txt', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });
        console.log('--- robots.txt ---');
        console.log(response.data);
    } catch (e) {
        console.log('Error:', e.message);
    }
}

checkRobots();
