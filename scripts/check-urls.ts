
import { fetchBloombergNews, fetchReutersNews } from '../lib/parser';

async function check() {
    console.log('Checking Bloomberg...');
    const bNews = await fetchBloombergNews();
    bNews.forEach(n => console.log(`[Bloomberg] ${n.title} -> ${n.url}`));

    console.log('Checking Reuters...');
    const rNews = await fetchReutersNews();
    rNews.forEach(n => console.log(`[Reuters] ${n.title} -> ${n.url}`));
}

check();
