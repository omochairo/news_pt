'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SymbolMarketData } from './market-data';

const MARKET_REFRESH_MS = 60 * 1000;

interface MarketDataValue {
    ticker: SymbolMarketData[];
    related: SymbolMarketData[];
}

const MarketDataContext = createContext<MarketDataValue>({ ticker: [], related: [] });

/**
 * /api/market を1分ごとに取得し、ティッカーと各記事の Sparkline に配る
 */
export function MarketDataProvider({ children }: { children: React.ReactNode }) {
    const [data, setData] = useState<MarketDataValue>({ ticker: [], related: [] });

    useEffect(() => {
        let cancelled = false;

        async function fetchData() {
            try {
                const res = await fetch('/api/market', { cache: 'no-store' });
                if (!res.ok) throw new Error('Market API failed');
                const json = await res.json();
                if (!cancelled && Array.isArray(json.data)) {
                    setData({ ticker: json.data, related: Array.isArray(json.related) ? json.related : [] });
                }
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
    return useContext(MarketDataContext).ticker;
}

/** 記事の下のチャート用に、world-markets の symbol で1件引く。未取得・取得失敗なら null */
export function useRelatedQuote(symbol: string): SymbolMarketData | null {
    const { related } = useContext(MarketDataContext);
    return related.find(d => d.symbol === symbol) ?? null;
}
