'use client';

import React from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { scoreImportance, IMPORTANCE_CONFIGS } from '@/lib/importance';
import { categorizeArticle, getCategoryConfig } from '@/lib/categorizer';
import { detectRelatedSymbol } from '@/lib/market-data';
import { checkPaywall } from '@/lib/paywall';
import Sparkline from './Sparkline';

const SOURCE_COLORS: Record<NewsSource, string> = {
    Bloomberg: 'var(--accent-bloomberg)',
    Reuters: 'var(--accent-reuters)',
    CNN: 'var(--accent-cnn)',
    Nikkei: 'var(--accent-nikkei)',
    MinkabuFX: 'var(--accent-minkabu)',
    Crypto: 'var(--accent-crypto)',
};

interface CompactNewsListProps {
    items: NewsItem[];
    title: string;
    source: NewsSource | 'mixed';
    onBookmark?: (item: NewsItem) => void;
    bookmarkedUrls?: Set<string>;
    readUrls?: Set<string>;
    onMarkRead?: (url: string) => void;
}

export default function CompactNewsList({
    items,
    title,
    source,
    onBookmark,
    bookmarkedUrls,
    readUrls,
    onMarkRead,
}: CompactNewsListProps) {
    const accentColor = source === 'mixed' ? 'var(--accent-bloomberg)' : SOURCE_COLORS[source];

    return (
        <div className="compact-news-list glass-panel">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--card-border)] flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                    <span
                        className="w-1.5 h-5 rounded-full"
                        style={source === 'mixed' ? {
                            background: `linear-gradient(180deg, var(--accent-bloomberg), var(--accent-reuters), var(--accent-cnn))`,
                        } : {
                            backgroundColor: accentColor,
                            boxShadow: `0 0 8px ${accentColor}`,
                        }}
                    />
                    {title}
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--background)] border border-[var(--card-border)]">
                    {items.length} ITEMS
                </span>
            </div>

            {/* List */}
            <div className="compact-news-items">
                {items.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[var(--text-secondary)] text-sm">
                        該当するニュースがありません
                    </div>
                ) : (
                    items.map((item, index) => {
                        const importance = scoreImportance(item.title);
                        const impConfig = IMPORTANCE_CONFIGS[importance];
                        const category = categorizeArticle(item.title);
                        const catConfig = getCategoryConfig(category);
                        const isBm = bookmarkedUrls?.has(item.url);
                        const isRead = readUrls?.has(item.url);
                        const itemColor = SOURCE_COLORS[item.source];

                        return (
                            <div
                                key={`${item.url}-${index}`}
                                className={`compact-news-item group transition-opacity ${isRead ? 'opacity-60 bg-black/20' : ''}`}
                                style={importance !== 'normal'
                                    ? { borderLeft: `2px solid ${impConfig.color}` }
                                    : { borderLeft: `2px solid ${itemColor}22` }
                                }
                            >
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => onMarkRead?.(item.url)}
                                    className="block px-5 py-3 hover:bg-white/[0.02] transition-colors"
                                >
                                    {/* Top line: source + category + importance + time */}
                                    <div className="flex items-center gap-2 mb-1.5">
                                        {/* Source badge (in mixed mode) */}
                                        {source === 'mixed' && (
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                style={{
                                                    backgroundColor: itemColor,
                                                    boxShadow: `0 0 6px ${itemColor}44`,
                                                }}
                                            >
                                                {item.source}
                                            </span>
                                        )}
                                        <span className="text-[9px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">
                                            {catConfig.icon} {catConfig.labelEn}
                                        </span>
                                        {importance !== 'normal' && (
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0 rounded-full uppercase"
                                                style={{ color: impConfig.color, backgroundColor: impConfig.bgColor }}
                                            >
                                                {impConfig.label}
                                            </span>
                                        )}
                                        {(() => {
                                            const pw = checkPaywall(item);
                                            if (!pw.isPaywall) return null;
                                            return (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                                    {pw.label}
                                                </span>
                                            );
                                        })()}
                                        {isRead && (
                                            <span className="text-[9px] font-mono text-emerald-400/80 bg-emerald-950/40 px-1 rounded border border-emerald-800/30">
                                                ✓ 既読
                                            </span>
                                        )}
                                        <span className="ml-auto text-[10px] text-[var(--text-secondary)] font-mono flex-shrink-0">
                                            {item.time || '--:--'}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h4 className={`text-sm font-medium leading-snug transition-colors line-clamp-2 ${isRead ? 'text-gray-400 group-hover:text-gray-200' : 'text-gray-100 group-hover:text-white'}`}>
                                        {item.title}
                                    </h4>

                                    {/* Sparkline (Market Impact) */}
                                    {(() => {
                                        const symbolData = detectRelatedSymbol(item.title);
                                        if (!symbolData) return null;
                                        return (
                                            <div className="mt-2">
                                                <Sparkline data={symbolData} compact />
                                            </div>
                                        );
                                    })()}
                                </a>

                                {/* Bookmark button */}
                                {onBookmark && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onBookmark(item);
                                        }}
                                        className="bookmark-btn-compact"
                                        title={isBm ? 'ブックマーク解除' : 'ブックマーク'}
                                    >
                                        {isBm ? '★' : '☆'}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
