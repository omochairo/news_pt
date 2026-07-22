import {
    fetchNikkeiNews,
    fetchMinkabuFXNews,
    fetchBloombergNews,
    fetchReutersNews,
    fetchCNNNews,
} from '../lib/parser';

async function testAll() {
    console.log('Testing RSS Fetchers...');
    const [nikkei, minkabu, bloomberg, reuters, cnn] = await Promise.all([
        fetchNikkeiNews(),
        fetchMinkabuFXNews(),
        fetchBloombergNews(),
        fetchReutersNews(),
        fetchCNNNews(),
    ]);

    console.log(`Nikkei: ${nikkei.length} items. First:`, nikkei[0]?.title);
    console.log(`MinkabuFX: ${minkabu.length} items. First:`, minkabu[0]?.title);
    console.log(`Bloomberg: ${bloomberg.length} items. First:`, bloomberg[0]?.title);
    console.log(`Reuters: ${reuters.length} items. First:`, reuters[0]?.title);
    console.log(`CNN: ${cnn.length} items. First:`, cnn[0]?.title);
}

testAll();
