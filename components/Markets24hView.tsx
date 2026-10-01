'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { MARKETS, Quote24h, formatChange, formatPrice } from '@/lib/world-markets';
import { usePolling } from '@/lib/use-polling';
import { IntradayChart, formatTradeTime } from './MarketTile';

const REFRESH_MS = 60 * 1000;
const MAX_BAR_PERCENT = 10;
// 最後の足がこれより古ければ、取引が止まっている（週末など）と表示する
const STOPPED_AFTER_MS = 60 * 60 * 1000;

type Sort = 'default' | 'move';

/** 24 時間の騰落を 1% 刻みの目盛りで見せる（10% で頭打ち） */
function MoveBar({ percent }: { percent: number }) {
    const filled = Math.min(Math.abs(percent), MAX_BAR_PERCENT);
    const color = percent > 0 ? 'bg-green-500' : percent < 0 ? 'bg-red-500' : 'bg-gray-500';
    return (
        <div className="relative h-2 rounded-sm bg-[var(--card-bg-hover)] overflow-hidden" title={`24時間で ${formatChange(percent, 2)}%（1目盛り = 1%）`}>
            <div className={`absolute inset-y-0 left-0 ${color}`} style={{ width: `${(filled / MAX_BAR_PERCENT) * 100}%` }} />
            {Array.from({ length: MAX_BAR_PERCENT - 1 }, (_, i) => (
                <div key={i} className="absolute inset-y-0 w-px bg-[var(--background)]" style={{ left: `${((i + 1) / MAX_BAR_PERCENT) * 100}%` }} />
            ))}
        </div>
    );
}

function Tile24h({ quote, now }: { quote: Quote24h; now: Date }) {
    const def = MARKETS.find(m => m.symbol === quote.symbol);
    if (!def) return null;
    const direction = quote.change > 0 ? 'up' : quote.change < 0 ? 'down' : 'flat';
    const color = direction === 'up' ? '#22c55e' : direction === 'down' ? '#ef4444' : '#9ca3af';
    const changeClass = direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-gray-400';
    const stopped = now.getTime() - new Date(quote.to).getTime() > STOPPED_AFTER_MS;

    return (
        <div className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-2.5 flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 min-w-0">
                <span className="text-xs font-bold text-gray-200 truncate" title={def.note ? `${def.name}（${def.note}）` : def.name}>{def.name}</span>
                <span className={`text-[10px] font-mono shrink-0 ${stopped ? 'text-amber-400' : 'text-[var(--text-secondary)]'}`}>
                    {stopped ? `停止中 ${formatTradeTime(quote.to, now)}` : formatTradeTime(quote.to, now)}
                </span>
            </div>
            <div className={`text-xl font-bold font-mono leading-tight ${changeClass}`}>{formatChange(quote.changePercent, 2)}%</div>
            <MoveBar percent={quote.changePercent} />
            <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] min-w-0">
                <span className="text-gray-100 truncate">{formatPrice(quote.price, def)}</span>
                <span className="text-[var(--text-secondary)] shrink-0" title="24時間の高値と安値の差">幅 {quote.rangePercent.toFixed(2)}%</span>
            </div>
            <div className="h-12 mt-0.5">
                <IntradayChart history={quote.history} previousClose={quote.base} color={color} />
            </div>
            <div className="flex justify-between font-mono text-[9px] text-[var(--text-secondary)]">
                <span>安 {formatPrice(quote.low, def)}</span>
                <span>高 {formatPrice(quote.high, def)}</span>
            </div>
        </div>
    );
}

export default function Markets24hView() {
    const [quotes, setQuotes] = useState<Quote24h[]>([]);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => new Date());
    const [sort, setSort] = useState<Sort>('default');

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/world-markets/24h');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body: { quotes: Quote24h[]; updatedAt: string } = await res.json();
            setQuotes(body.quotes);
            setUpdatedAt(body.updatedAt);
            setError(false);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
            setNow(new Date());
        }
    }, []);

    usePolling(load, REFRESH_MS);

    const sorted = useMemo(() => {
        const order = MARKETS.filter(m => m.h24).map(m => m.symbol);
        const list = quotes.filter(q => order.includes(q.symbol));
        return sort === 'move'
            ? [...list].sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
            : [...list].sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));
    }, [quotes, sort]);

    if (loading && quotes.length === 0) {
        return <div className="py-20 text-center text-sm text-[var(--text-secondary)]">読み込み中...</div>;
    }

    return (
        <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h2 className="text-sm font-bold text-gray-300">
                    24時間の値動き
                    <span className="ml-2 text-[10px] font-normal text-[var(--text-secondary)]">
                        先物・為替・商品・暗号資産 / 更新 {updatedAt ? formatTradeTime(updatedAt, now) : '--:--'}
                    </span>
                </h2>
                <div className="flex items-center rounded-lg p-0.5 bg-[var(--card-bg)] border border-[var(--card-border)] text-xs" role="group" aria-label="並び順">
                    {([['default', '標準'], ['move', '変動の大きい順']] as [Sort, string][]).map(([id, label]) => (
                        <button
                            key={id}
                            onClick={() => setSort(id)}
                            aria-pressed={sort === id}
                            className={`px-2.5 py-1 rounded-md transition-colors ${sort === id ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {error && <div className="text-[10px] text-amber-400 mb-2">更新に失敗しました（前回の値を表示中）</div>}
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {sorted.map(q => <Tile24h key={q.symbol} quote={q} now={now} />)}
            </div>
            <p className="mt-3 text-[10px] text-[var(--text-secondary)] leading-relaxed">
                最後に値が付いた時刻からさかのぼった24時間の騰落です（週末で止まっている先物は止まる直前の24時間）。
                バーの1目盛りが1%で、10%まで表示します。点線は24時間前の値。
            </p>
        </section>
    );
}
