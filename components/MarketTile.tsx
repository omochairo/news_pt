'use client';

import React from 'react';
import { MarketDef, WorldQuote, formatChange, formatPrice } from '@/lib/world-markets';

const CHART_W = 100;
const CHART_H = 40;

/** 最後の足の時刻。当日（JST）なら HH:MM、別の日なら M/D */
function formatTradeTime(iso: string | undefined, now: Date): string {
    if (!iso) return '';
    const d = new Date(iso);
    const day = (x: Date) => x.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
    if (day(d) === day(now)) {
        return d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
}

function IntradayChart({ history, previousClose, color }: { history: number[]; previousClose: number; color: string }) {
    if (history.length < 2) {
        return <div className="h-full flex items-center justify-center text-[10px] text-[var(--text-secondary)]">チャートなし</div>;
    }
    // 前日終値の線が枠からはみ出さないよう、範囲に含める
    const min = Math.min(...history, previousClose);
    const max = Math.max(...history, previousClose);
    const range = max - min || 1;
    const y = (v: number) => CHART_H - ((v - min) / range) * (CHART_H - 4) - 2;
    const line = history.map((v, i) => `${((i / (history.length - 1)) * CHART_W).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const baseY = y(previousClose).toFixed(2);

    return (
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full h-full" aria-hidden="true">
            <polygon points={`0,${baseY} ${line} ${CHART_W},${baseY}`} fill={color} fillOpacity={0.15} />
            <line x1={0} x2={CHART_W} y1={baseY} y2={baseY} stroke="#6b7a8d" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

export default function MarketTile({ def, quote, now }: { def: MarketDef; quote?: WorldQuote; now: Date }) {
    const direction = !quote ? 'flat' : quote.change > 0 ? 'up' : quote.change < 0 ? 'down' : 'flat';
    const color = direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#9ca3af';
    const changeClass = direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-gray-400';

    return (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2.5 flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-200 truncate" title={def.note ? `${def.name}（${def.note}）` : def.name}>
                    {def.name}
                </span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)] shrink-0">
                    {formatTradeTime(quote?.lastTradeAt, now)}
                </span>
            </div>

            {quote ? (
                <>
                    <div className={`text-xl font-bold font-mono leading-tight ${changeClass}`}>
                        {formatChange(quote.changePercent, 2)}%
                    </div>
                    <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] min-w-0">
                        <span className="text-gray-100 truncate">{formatPrice(quote.price, def)}</span>
                        <span className={`${changeClass} shrink-0`}>{formatChange(quote.change, def.decimals ?? 2)}</span>
                    </div>
                    <div className="h-12 mt-0.5">
                        <IntradayChart history={quote.history} previousClose={quote.previousClose} color={color} />
                    </div>
                </>
            ) : (
                <div className="h-[92px] flex items-center justify-center text-xs text-[var(--text-secondary)]">取得できませんでした</div>
            )}

            {def.note && <div className="text-[9px] text-[var(--text-secondary)] truncate">{def.note}</div>}
        </div>
    );
}
