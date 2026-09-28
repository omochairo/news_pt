'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MARKETS, MarketRegion, REGIONS, WorldQuote } from '@/lib/world-markets';
import MarketTile from './MarketTile';

const REFRESH_MS = 60 * 1000;
type Tab = 'all' | MarketRegion;

export default function WorldMarketsBoard() {
    const [quotes, setQuotes] = useState<Record<string, WorldQuote>>({});
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [now, setNow] = useState(() => new Date());

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/world-markets');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body: { quotes: WorldQuote[]; updatedAt: string } = await res.json();
            setQuotes(Object.fromEntries(body.quotes.map(q => [q.symbol, q])));
            setUpdatedAt(body.updatedAt);
            setError(false);
        } catch {
            // 取れなかった回は前回の表示を残す
            setError(true);
        } finally {
            setLoading(false);
            setNow(new Date());
        }
    }, []);

    // 1分ごとに更新。タブが裏にある間は止め、表に戻ったらすぐ取り直す
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        const start = () => {
            if (timer) return;
            load();
            timer = setInterval(load, REFRESH_MS);
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = undefined;
        };
        const onVisibility = () => (document.hidden ? stop() : start());

        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [load]);

    const sections = useMemo(
        () => REGIONS
            .filter(r => tab === 'all' || r.id === tab)
            .map(r => ({ ...r, markets: MARKETS.filter(m => m.region === r.id) })),
        [tab],
    );

    const updatedLabel = updatedAt
        ? new Date(updatedAt).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '--:--:--';

    return (
        <main className="container min-h-screen py-6">
            <header className="mb-5 space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <Link href="/" className="text-xs text-[var(--text-secondary)] hover:text-gray-200">← ニュースに戻る</Link>
                        <h1 className="text-2xl md:text-4xl font-bold text-gray-100 mt-1">世界の市場</h1>
                    </div>
                    <div className="text-right font-mono">
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">LAST SYNC (JST)</div>
                        <div className="text-lg">{updatedLabel}</div>
                        {error && <div className="text-[10px] text-amber-400">更新に失敗しました（前回の値を表示中）</div>}
                    </div>
                </div>

                <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]" aria-label="地域">
                    {[{ id: 'all' as Tab, label: 'すべて' }, ...REGIONS].map(r => (
                        <button
                            key={r.id}
                            onClick={() => setTab(r.id)}
                            className={`shrink-0 px-3 py-1 rounded-full text-xs border transition-colors ${
                                tab === r.id
                                    ? 'bg-blue-600 border-blue-500 text-white font-bold'
                                    : 'border-[var(--card-border)] text-gray-400 hover:text-gray-200'
                            }`}
                        >
                            {r.label}
                        </button>
                    ))}
                </nav>
            </header>

            {loading && Object.keys(quotes).length === 0 ? (
                <div className="py-20 text-center text-sm text-[var(--text-secondary)]">読み込み中...</div>
            ) : (
                <div className="space-y-6">
                    {sections.map(section => (
                        <section key={section.id}>
                            <h2 className="text-sm font-bold text-gray-300 mb-2">{section.label}</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                                {section.markets.map(def => (
                                    <MarketTile key={def.symbol} def={def} quote={quotes[def.symbol]} now={now} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            <p className="mt-8 text-[10px] text-[var(--text-secondary)] leading-relaxed">
                データは Yahoo Finance から取得しています。指数は 15〜20 分程度遅れることがあります。点線は前日終値。
                TOPIX・グロース250 は連動 ETF、全世界株式は ETF ACWI の値です。
            </p>
        </main>
    );
}
