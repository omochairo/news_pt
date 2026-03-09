'use client';

import React, { useEffect, useState } from 'react';

interface MarketItem {
    symbol: string;
    name: string;
    price: string;
    change: string;
    changePercent: string;
    direction: 'up' | 'down' | 'flat';
}

export default function MarketTicker() {
    const [data, setData] = useState<MarketItem[]>([]);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/market');
                if (!res.ok) throw new Error('Market API failed');
                const json = await res.json();
                setData(json.data || []);
            } catch (e) {
                console.error('Market ticker error:', e);
            }
        }

        fetchData();
        const interval = setInterval(fetchData, 60 * 1000); // 1分ごとに更新
        return () => clearInterval(interval);
    }, []);

    if (data.length === 0) return null;

    // 2セット並べて無限スクロール効果を出す
    const items = [...data, ...data];

    return (
        <div
            className="ticker-wrapper"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <div className={`ticker-track ${paused ? 'ticker-paused' : ''}`}>
                {items.map((item, i) => (
                    <div key={`${item.symbol}-${i}`} className="ticker-item">
                        <span className="ticker-name">{item.name}</span>
                        <span className="ticker-price">{item.price}</span>
                        <span className={`ticker-change ${item.direction === 'up' ? 'ticker-up' : item.direction === 'down' ? 'ticker-down' : ''}`}>
                            {item.direction === 'up' ? '▲' : item.direction === 'down' ? '▼' : '●'}
                            {' '}{item.changePercent}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
