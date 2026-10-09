'use client';

import React from 'react';
import { useRelatedQuote } from '@/lib/market-context';

interface SparklineProps {
    symbol: string; // world-markets の symbol（related-news.ts の detectPrimaryMarket の戻り値）
    compact?: boolean;
}

export default function Sparkline({ symbol, compact = false }: SparklineProps) {
    const quote = useRelatedQuote(symbol);
    // 相場データが未取得・取得失敗のときは、古い値を見せるより出さない
    if (!quote) return null;

    const { name, price, changePercent, direction, history } = quote;
    const isUp = direction === 'up';
    const isDown = direction === 'down';
    const strokeColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#9ca3af';
    const fillColor = isUp ? 'rgba(34, 197, 94, 0.15)' : isDown ? 'rgba(239, 68, 68, 0.15)' : 'rgba(156, 163, 175, 0.15)';
    const changeClass = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400';

    // SVG 座標の計算
    const width = compact ? 60 : 80;
    const height = 22;
    const hasChart = history.length >= 2;
    const min = hasChart ? Math.min(...history) : 0;
    const max = hasChart ? Math.max(...history) : 0;
    const range = max - min || 1;

    const points = hasChart
        ? history.map((val, idx) => {
            const x = (idx / (history.length - 1)) * width;
            const y = height - ((val - min) / range) * (height - 4) - 2;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ')
        : '';

    const fillPoints = `0,${height} ${points} ${width},${height}`;

    return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--card-bg-hover)] border border-[var(--card-border)] text-xs font-mono">
            <span className="font-semibold text-gray-300">{name}</span>
            <span className="text-gray-100 font-bold">{price}</span>
            <span className={`font-bold text-[11px] ${changeClass}`}>
                {changePercent}
            </span>

            {/* SVG Sparkline */}
            {hasChart && (
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
            )}
        </div>
    );
}
