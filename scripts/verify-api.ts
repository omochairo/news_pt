import { GET } from '../app/api/news/route';

async function testApiRoute() {
    console.log('--- Test 1: First Call (Fetch & Cache) ---');
    const req1 = new Request('http://localhost:3000/api/news');
    const res1 = await GET(req1);
    const data1 = await res1.json();
    console.log('Status:', res1.status);
    console.log('X-Cache Header:', res1.headers.get('X-Cache'));
    console.log('Nikkei Count:', data1.nikkei?.length);
    console.log('Minkabu Count:', data1.minkabu?.length);
    console.log('Bloomberg Count:', data1.bloomberg?.length);
    console.log('Reuters Count:', data1.reuters?.length);
    console.log('CNN Count:', data1.cnn?.length);

    console.log('\n--- Test 2: Immediate Second Call (Memory Cache HIT) ---');
    const req2 = new Request('http://localhost:3000/api/news');
    const res2 = await GET(req2);
    const data2 = await res2.json();
    console.log('Status:', res2.status);
    console.log('X-Cache Header:', res2.headers.get('X-Cache'));
    console.log('Is Cached Data Equal?:', JSON.stringify(data1) === JSON.stringify(data2));
}

testApiRoute();
