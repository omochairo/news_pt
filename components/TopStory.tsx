'use client';

import React from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { scoreImportance, IMPORTANCE_CONFIGS } from '@/lib/importance';
import { categorizeArticle, getCategoryConfig } from '@/lib/categorizer';
import { detectRelatedSymbol } from '@/lib/market-data';
import Sparkline from './Sparkline';

const SOURCE_COLORS: Record<NewsSource, string> = {
    Bloomberg: 'var(--accent-bloomberg)',
    Reuters: 'var(--accent-reuters)',
    CNN: 'var(--accent-cnn)',
    Nikkei: 'var(--accent-nikkei)',
    MinkabuFX: 'var(--accent-minkabu)',
};

interface TopStoryProps {
    item: NewsItem;
    onBookmark?: (item: NewsItem) => void;
    isBookmarked?: boolean;
}

export default function TopStory({ item, onBookmark, isBookmarked }: TopStoryProps) {
    const accentColor = SOURCE_COLORS[item.source];
    const importance = scoreImportance(item.title);
    const importanceConfig = IMPORTANCE_CONFIGS[importance];
    const category = categorizeArticle(item.title);
    const categoryConfig = getCategoryConfig(category);

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="top-story glass-panel group relative block"
        >
            {/* Accent border top */}
            <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }}
            />

            {/* Background Glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at top left, ${accentColor}, transparent 70%)` }}
            />

            <div className="relative z-10 p-8">
                {/* Top bar: badges */}
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                    {/* Source badge */}
                    <span
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white uppercase tracking-wider"
                        style={{
                            backgroundColor: accentColor,
                            boxShadow: `0 0 12px ${accentColor}44`
                        }}
                    >
                        {item.source}
                    </span>

                    {/* Category badge */}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--card-border)] text-[var(--text-secondary)] uppercase tracking-widest">
                        {categoryConfig.icon} {categoryConfig.labelEn}
                    </span>

                    {/* Importance badge */}
                    {importance !== 'normal' && (
                        <span
                            className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse"
                            style={{
                                color: importanceConfig.color,
                                backgroundColor: importanceConfig.bgColor,
                                boxShadow: `0 0 8px ${importanceConfig.glowColor}`
                            }}
                        >
                            ● {importanceConfig.label}
                        </span>
                    )}

                    {/* Sparkline */}
                    {(() => {
                        const symbolData = detectRelatedSymbol(item.title);
                        if (!symbolData) return null;
                        return <Sparkline data={symbolData} />;
                    })()}

                    {/* Time */}
                    <span className="ml-auto text-xs text-[var(--text-secondary)] font-mono">
                        {item.time || 'JUST NOW'}
                    </span>
                </div>

                {/* Title */}
                <h2 className="text-2xl md:text-3xl font-bold leading-snug mb-4 group-hover:text-white transition-colors">
                    {item.title}
                </h2>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-[var(--card-border)]">
                    <span className="text-xs text-[var(--text-secondary)] font-mono uppercase tracking-widest">
                        TOP STORY • {item.source}
                    </span>
                    <div className="flex items-center gap-3">
                        {onBookmark && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onBookmark(item);
                                }}
                                className="bookmark-btn"
                                title={isBookmarked ? 'ブックマーク解除' : 'ブックマーク'}
                            >
                                {isBookmarked ? '★' : '☆'}
                            </button>
                        )}
                        <span className="text-white opacity-40 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-mono uppercase tracking-widest">
                            READ FULL STORY
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
        </a>
    );
}
