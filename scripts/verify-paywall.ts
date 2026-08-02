import { checkPaywall } from '../lib/paywall';
import { NewsItem } from '../lib/parser';

const testItems: NewsItem[] = [
    {
        title: '【今朝の5本】仕事を始める前に読んでおきたい厳選ニュース',
        url: 'https://www.bloomberg.co.jp/news/articles/2026-07-22/test1',
        source: 'Bloomberg',
        time: '08:00',
    },
    {
        title: '日経平均株価、大幅続伸［有料会員限定］',
        url: 'https://www.nikkei.com/article/DGXZQOUB000001/',
        source: 'Nikkei',
        time: '09:00',
    },
    {
        title: '米FRB、政策金利を据え置き決定',
        url: 'https://jp.reuters.com/article/test',
        source: 'Reuters',
        time: '10:00',
    },
];

console.log('--- Paywall Verification Test ---');
for (const item of testItems) {
    const res = checkPaywall(item);
    console.log(`[${item.source}] ${item.title}`);
    console.log(`   -> Paywall: ${res.isPaywall} (Label: "${res.label}")\n`);
}
