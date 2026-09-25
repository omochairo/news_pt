'use client';

import React, { useState } from 'react';
import { useMarketData } from '@/lib/market-context';

export default function MarketTicker() {
    const data = useMarketData();
    const [paused, setPaused] = useState(false);

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
