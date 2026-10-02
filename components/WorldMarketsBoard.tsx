'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MARKETS, MarketRegion, REGIONS, WorldQuote, getMarketStatus } from '@/lib/world-markets';
import { usePolling } from '@/lib/use-polling';
import { readFavorites, saveFavorites, toggleFavorite } from '@/lib/favorites';
import MarketTile from './MarketTile';
import Markets24hView from './Markets24hView';
import MarketDetailDialog from './MarketDetailDialog';
import { MoveAlertsToggle } from './MoveAlerts';

const REFRESH_MS = 60 * 1000;
type Tab = 'all' | MarketRegion | '24h';
type Layout = 'normal' | 'dense';

const LAYOUT_STORAGE_KEY = 'vantage-point-markets-layout';
// Tailwind はクラス名を静的に拾うので、組み立てずにそのまま書く
const GRID_CLASSES: Record<Layout, string> = {
    normal: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    dense: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8',
};
const LAYOUTS: { id: Layout; label: string }[] = [
    { id: 'normal', label: '横4つ' },
    { id: 'dense', label: '横8つ' },
];

// 表示の好みは端末ごとでよいので localStorage。使えない環境（プライベートモード等）では既定のまま
function readLayout(): Layout {
    try {
        return localStorage.getItem(LAYOUT_STORAGE_KEY) === 'dense' ? 'dense' : 'normal';
    } catch {
        return 'normal';
    }
}

function saveLayout(layout: Layout) {
    try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {
        // 保存できなくても表示は切り替わる
    }
}

export default function WorldMarketsBoard() {
    const [quotes, setQuotes] = useState<Record<string, WorldQuote>>({});
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [now, setNow] = useState(() => new Date());
    const [layout, setLayout] = useState<Layout>('normal');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [detailSymbol, setDetailSymbol] = useState<string | null>(null);

    // サーバー描画と食い違わないよう、保存値はマウント後に読む
    useEffect(() => {
        setLayout(readLayout());
        setFavorites(readFavorites());
    }, []);

    const onToggleFavorite = useCallback((symbol: string) => {
        setFavorites(prev => {
            const next = toggleFavorite(prev, symbol);
            saveFavorites(next);
            return next;
        });
    }, []);

    const changeLayout = (next: Layout) => {
        setLayout(next);
        saveLayout(next);
    };

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

    // 1分ごとに更新（タブが裏にある間は止まる）。24時間タブの間はそちらが取得するので止める
    usePolling(load, REFRESH_MS, tab !== '24h');

    const sections = useMemo(() => {
        const regions = REGIONS
            .filter(r => tab === 'all' || r.id === tab)
            .map(r => ({ id: r.id as string, label: r.label, markets: MARKETS.filter(m => m.region === r.id) }));
        // お気に入りは「すべて」の先頭にだけ出す（各地域の中にも残る）
        if (tab !== 'all' || favorites.length === 0) return regions;
        const picked = new Set(favorites);
        return [{ id: 'favorites', label: 'お気に入り', markets: MARKETS.filter(m => picked.has(m.symbol)) }, ...regions];
    }, [tab, favorites]);

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
                    <div className="flex items-end gap-3">
                        <MoveAlertsToggle />
                        {/* 24時間タブは自前で取得・表示するので、ここはグリッドの更新時刻だけ出す */}
                        {tab !== '24h' && (
                            <div className="text-right font-mono">
                                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">LAST SYNC (JST)</div>
                                <div className="text-lg">{updatedLabel}</div>
                                {error && <div className="text-[10px] text-amber-400">更新に失敗しました（前回の値を表示中）</div>}
                            </div>
                        )}
                    </div>
                </div>

                {tab !== '24h' && (
                    <div className="flex items-center justify-end gap-3">
                        <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />取引中
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-600 ml-2" />時間外
                        </div>
                        <div className="flex items-center rounded-lg p-0.5 bg-[var(--card-bg)] border border-[var(--card-border)] text-xs" role="group" aria-label="表示の大きさ">
                            {LAYOUTS.map(l => (
                                <button
                                    key={l.id}
                                    onClick={() => changeLayout(l.id)}
                                    aria-pressed={layout === l.id}
                                    className={`px-2.5 py-1 rounded-md transition-colors ${
                                        layout === l.id ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                >
                                    {l.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]" aria-label="地域">
                    {[{ id: 'all' as Tab, label: 'すべて' }, ...REGIONS, { id: '24h' as Tab, label: '24時間' }].map(r => (
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

            {tab === '24h' ? (
                <Markets24hView />
            ) : loading && Object.keys(quotes).length === 0 ? (
                <div className="py-20 text-center text-sm text-[var(--text-secondary)]">読み込み中...</div>
            ) : (
                <div className="space-y-6">
                    {sections.map(section => {
                        const openCount = section.markets.filter(m => quotes[m.symbol] && getMarketStatus(quotes[m.symbol], now) === 'open').length;
                        return (
                            <section key={section.id}>
                                <h2 className="text-sm font-bold text-gray-300 mb-2 flex items-baseline gap-2">
                                    {section.label}
                                    <span className="text-[10px] font-normal text-[var(--text-secondary)]">
                                        取引中 {openCount}/{section.markets.length}
                                    </span>
                                </h2>
                                <div className={`grid gap-2 ${GRID_CLASSES[layout]}`}>
                                    {section.markets.map(def => (
                                        <MarketTile
                                            key={def.symbol}
                                            def={def}
                                            quote={quotes[def.symbol]}
                                            now={now}
                                            dense={layout === 'dense'}
                                            favorite={favorites.includes(def.symbol)}
                                            onToggleFavorite={onToggleFavorite}
                                            onOpen={setDetailSymbol}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            <MarketDetailDialog
                def={MARKETS.find(m => m.symbol === detailSymbol) ?? null}
                quote={detailSymbol ? quotes[detailSymbol] : undefined}
                onClose={() => setDetailSymbol(null)}
            />

            <p className="mt-8 text-[10px] text-[var(--text-secondary)] leading-relaxed">
                データは Yahoo Finance から取得しています。指数は 15〜20 分程度遅れることがあります。点線は前日終値。☆ で選んだ銘柄は「すべて」の先頭に出ます（この端末にだけ保存）。タイルを押すと 5 日・1 か月・1 年のチャートが開きます。
                TOPIX・グロース250 は連動 ETF、全世界株式は ETF ACWI の値です。
                日本国債10年利回りは財務省「国債金利情報」（日次の終値）を加工して作成しています（前営業日の値。点線は前々営業日）。
            </p>
        </main>
    );
}
