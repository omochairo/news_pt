'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SymbolMarketData } from './market-data';

const MARKET_REFRESH_MS = 60 * 1000;

const MarketDataContext = createContext<SymbolMarketData[]>([]);

/**
 * /api/market を1分ごとに取得し、ティッカーと各記事の Sparkline に同じデータを配る
 */
export function MarketDataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<SymbolMarketData[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                const res = await fetch('/api/market', { cache: 'no-store' });
                if (!res.ok) throw new Error('Market API failed');
                const json = await res.json();
                if (!cancelled && Array.isArray(json.data)) setData(json.data);
            } catch (e) {
                console.error('Market data error:', e);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, MARKET_REFRESH_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    return <MarketDataContext.Provider value={data}>{children}</MarketDataContext.Provider>;
}

export function useMarketData(): SymbolMarketData[] {
    return useContext(MarketDataContext);
}

/** 銘柄名で1件引く。未取得・取得失敗なら null */
export function useMarketQuote(name: string): SymbolMarketData | null {
    const data = useMarketData();
    const quote = data.find(d => d.name === name);
    return quote && quote.price !== '--' ? quote : null;
}
