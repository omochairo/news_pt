'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HISTORY_RANGES, HistoryRange, MarketDef, QuoteHistory, WorldQuote, formatChange, formatPrice } from '@/lib/world-markets';

const W = 600;
const H = 220;
const PAD_Y = 8;

function formatAt(iso: string, range: HistoryRange): string {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions = range === '1y'
        ? { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric' }
        : { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return d.toLocaleString('ja-JP', opts);
}

function DetailChart({ history, color }: { history: QuoteHistory; color: string }) {
    const { points, first, high, low } = history;
    const range = high - low || 1;
    const y = (v: number) => PAD_Y + (1 - (v - low) / range) * (H - PAD_Y * 2);
    const line = points.map((p, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const baseY = y(first).toFixed(1);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-48 sm:h-56" aria-hidden="true">
            <polygon points={`0,${baseY} ${line} ${W},${baseY}`} fill={color} fillOpacity={0.15} />
            <line x1={0} x2={W} y1={baseY} y2={baseY} stroke="#6b7a8d" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <polyline points={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}

interface Props {
    def: MarketDef | null;
    quote?: WorldQuote;
    onClose: () => void;
}

/** タイルを押したときの詳細チャート。期間ごとの推移は開いたときだけ取りに行く */
export default function MarketDetailDialog({ def, quote, onClose }: Props) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [range, setRange] = useState<HistoryRange>('5d');
    const [histories, setHistories] = useState<Record<string, QuoteHistory | 'error'>>({});

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (def && !dialog.open) dialog.showModal();
        else if (!def && dialog.open) dialog.close();
    }, [def]);

    // 次に開いたときは 5 日から、最新の値で出す（取り直しはサーバー側のキャッシュが受ける）
    const handleClose = () => {
        setRange('5d');
        setHistories({});
        onClose();
    };

    const key = def ? `${def.symbol}|${range}` : '';
    const history = key ? histories[key] : undefined;

    useEffect(() => {
        if (!def || histories[key]) return;
        let cancelled = false;
        fetch(`/api/world-markets/history?symbol=${encodeURIComponent(def.symbol)}&range=${range}`)
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then((data: QuoteHistory) => { if (!cancelled) setHistories(prev => ({ ...prev, [key]: data })); })
            .catch(() => { if (!cancelled) setHistories(prev => ({ ...prev, [key]: 'error' })); });
        return () => { cancelled = true; };
        // histories は結果を書き込むだけなので依存に入れない（入れると取得のたびに再実行される）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [def, range]);

    const retry = () => setHistories(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
    });

    const loaded = history && history !== 'error' ? history : null;
    const direction = loaded ? Math.sign(loaded.change) : 0;
    const color = direction > 0 ? '#22c55e' : direction < 0 ? '#ef4444' : '#9ca3af';
    const changeClass = direction > 0 ? 'text-green-400' : direction < 0 ? 'text-red-400' : 'text-gray-400';

    return (
        <dialog
            ref={dialogRef}
            onClose={handleClose}
            onClick={e => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}
            className="m-auto w-[min(640px,calc(100vw-32px))] rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-gray-200 p-0 backdrop:bg-black/60"
            aria-label={def ? `${def.name}の詳細チャート` : undefined}
        >
            {def && (
                <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-gray-100 truncate">{def.name}</h2>
                            {def.note && <div className="text-[11px] text-[var(--text-secondary)]">{def.note}</div>}
                        </div>
                        <button
                            type="button"
                            onClick={() => dialogRef.current?.close()}
                            className="shrink-0 px-2 text-xl leading-none text-gray-400 hover:text-gray-200"
                            aria-label="閉じる"
                        >
                            ×
                        </button>
                    </div>

                    <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono">
                        <span className="text-2xl text-gray-100">{quote ? formatPrice(quote.price, def) : '--'}</span>
                        {loaded && (
                            <span className={`text-sm ${changeClass}`}>
                                {HISTORY_RANGES.find(r => r.id === range)!.label}で {formatChange(loaded.changePercent, 2)}%
                                （{formatChange(loaded.change, def.decimals ?? 2)}）
                            </span>
                        )}
                    </div>

                    <div className="flex items-center rounded-lg p-0.5 bg-[var(--background)] border border-[var(--card-border)] text-xs w-fit" role="group" aria-label="期間">
                        {HISTORY_RANGES.map(r => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => setRange(r.id)}
                                aria-pressed={range === r.id}
                                className={`px-3 py-1 rounded-md transition-colors ${
                                    range === r.id ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-48 sm:min-h-56">
                        {loaded ? (
                            <>
                                <DetailChart history={loaded} color={color} />
                                <div className="flex justify-between text-[10px] font-mono text-[var(--text-secondary)] mt-1">
                                    <span>{formatAt(loaded.points[0].t, range)}</span>
                                    <span>{formatAt(loaded.points.at(-1)!.t, range)}</span>
                                </div>
                                <dl className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-mono">
                                    <div><dt className="text-[var(--text-secondary)]">始値</dt><dd>{formatPrice(loaded.first, def)}</dd></div>
                                    <div><dt className="text-[var(--text-secondary)]">高値</dt><dd>{formatPrice(loaded.high, def)}</dd></div>
                                    <div><dt className="text-[var(--text-secondary)]">安値</dt><dd>{formatPrice(loaded.low, def)}</dd></div>
                                </dl>
                            </>
                        ) : history === 'error' ? (
                            <div className="h-48 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                                取得できませんでした
                                <button type="button" onClick={retry} className="px-3 py-1 rounded border border-[var(--card-border)] hover:text-gray-200">
                                    再読み込み
                                </button>
                            </div>
                        ) : (
                            <div className="h-48 flex items-center justify-center text-xs text-[var(--text-secondary)]">読み込み中...</div>
                        )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)]">点線は期間の始値。時刻は日本時間。</p>
                </div>
            )}
        </dialog>
    );
}
