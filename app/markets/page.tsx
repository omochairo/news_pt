import type { Metadata } from 'next';
import WorldMarketsBoard from '@/components/WorldMarketsBoard';

export const metadata: Metadata = {
    title: '世界の市場 | Vantage Point',
    description: '世界の株価指数・為替・金利・商品・暗号資産の騰落率と当日チャート',
};

export default function MarketsPage() {
    return <WorldMarketsBoard />;
}
