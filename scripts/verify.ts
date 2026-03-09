import { fetchBloombergNews, fetchReutersNews } from '../lib/parser';

async function verify() {
    console.log('Testing Bloomberg Fetch...');
    const bloomberg = await fetchBloombergNews();
    console.log(`Found ${bloomberg.length} items from Bloomberg.`);
    if (bloomberg.length > 0) {
        console.log('First item:', bloomberg[0]);
    } else {
        console.error('FAILED to fetch Bloomberg news.');
    }

    console.log('\nTesting Reuters Fetch...');
    const reuters = await fetchReutersNews();
    console.log(`Found ${reuters.length} items from Reuters.`);
    if (reuters.length > 0) {
        console.log('First item:', reuters[0]);
    } else {
        console.error('FAILED to fetch Reuters news.');
    }
}

verify();
