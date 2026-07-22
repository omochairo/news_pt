'use client';

import React from 'react';
import { SymbolMarketData } from '@/lib/market-data';

interface SparklineProps {
    data: SymbolMarketData;
    compact?: boolean;
}

export default function Sparkline({ data, compact = false }: SparklineProps) {
    const { name, price, changePercent, direction, history } = data;
    const isUp = direction === 'up';
    const strokeColor = isUp ? '#22c55e' : '#ef4444';
    const fillColor = isUp ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)';

    // SVG 座標の計算
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const width = compact ? 60 : 80;
    const height = 22;

    const points = history.map((val, idx) => {
        const x = (idx / (history.length - 1)) * width;
        const y = height - ((val - min) / range) * (height - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const fillPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--card-bg-hover)] border border-[var(--card-border)] text-xs font-mono">
            <span className="font-semibold text-gray-300">{name}</span>
            <span className="text-gray-100 font-bold">{price}</span>
            <span className={`font-bold text-[11px] ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                {changePercent}
            </span>

            {/* SVG Sparkline */}
            <svg width={width} height={height} className="overflow-visible">
                <polygon points={fillPoints} fill={fillColor} />
                <polyline
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                />
            </svg>
        </div>
    );
}
