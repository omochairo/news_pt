import { fetchBloombergNews, fetchReutersNews } from '../lib/parser';

async function test() {
    console.log('--- Testing Bloomberg ---');
    try {
        const bloomberg = await fetchBloombergNews();
        console.log(`Found ${bloomberg.length} items`);
        if (bloomberg.length > 0) {
            console.log('First item:', bloomberg[0]);
        }
    } catch (e) {
        console.error('Bloomberg failed:', e);
    }

    console.log('\n--- Testing Reuters ---');
    try {
        const reuters = await fetchReutersNews();
        console.log(`Found ${reuters.length} items`);
        if (reuters.length > 0) {
            console.log('First item:', reuters[0]);
        }
    } catch (e) {
        console.error('Reuters failed:', e);
    }
}

test();
