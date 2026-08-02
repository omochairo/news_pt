'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { NewsCategory, categorizeArticle, CATEGORIES } from '@/lib/categorizer';
import SourceToggle, { ALL_SOURCES } from './SourceToggle';
import CategoryTabs from './CategoryTabs';
import CompactNewsList from './CompactNewsList';

interface SplitViewFeedProps {
    data: {
        nikkei?: NewsItem[];
        minkabu?: NewsItem[];
        bloomberg?: NewsItem[];
        reuters?: NewsItem[];
        cnn?: NewsItem[];
        crypto?: NewsItem[];
    } | null;
    onBookmark?: (item: NewsItem) => void;
    bookmarkedUrls?: Set<string>;
    readUrls?: Set<string>;
    onMarkRead?: (url: string) => void;
}

interface PanelState {
    sources: Set<NewsSource>;
    category: NewsCategory;
    search: string;
}

export default function SplitViewFeed({
    data,
    onBookmark,
    bookmarkedUrls,
    readUrls,
    onMarkRead,
}: SplitViewFeedProps) {
    // 左パネルと右パネルの個別ステート
    const [leftState, setLeftState] = useState<PanelState>({
        sources: new Set(['Nikkei', 'MinkabuFX', 'Bloomberg', 'Reuters', 'CNN']),
        category: 'all',
        search: '',
    });

    const [rightState, setRightState] = useState<PanelState>({
        sources: new Set(['Crypto']),
        category: 'all',
        search: '',
    });

    // フィルタリング処理関数
    const getFilteredItems = useCallback((panel: PanelState) => {
        if (!data) return [];
        const items: NewsItem[] = [];

        if (panel.sources.has('Nikkei')) items.push(...(data.nikkei || []));
        if (panel.sources.has('MinkabuFX')) items.push(...(data.minkabu || []));
        if (panel.sources.has('Crypto')) items.push(...(data.crypto || []));
        if (panel.sources.has('Bloomberg')) items.push(...(data.bloomberg || []));
        if (panel.sources.has('Reuters')) items.push(...(data.reuters || []));
        if (panel.sources.has('CNN')) items.push(...(data.cnn || []));

        let filtered = items;
        if (panel.search) {
            const query = panel.search.toLowerCase();
            filtered = filtered.filter(i => i.title.toLowerCase().includes(query));
        }
        if (panel.category !== 'all') {
            filtered = filtered.filter(i => categorizeArticle(i.title) === panel.category);
        }

        return filtered.sort((a, b) => {
            if (a.isoDate && b.isoDate) {
                return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
            }
            return (b.time || '00:00').localeCompare(a.time || '00:00');
        });
    }, [data]);

    const leftItems = useMemo(() => getFilteredItems(leftState), [leftState, getFilteredItems]);
    const rightItems = useMemo(() => getFilteredItems(rightState), [rightState, getFilteredItems]);

    // 左パネル ソーストグル
    const handleLeftSourceToggle = (source: NewsSource) => {
        setLeftState(prev => {
            const next = new Set(prev.sources);
            if (next.has(source)) {
                if (next.size > 1) next.delete(source);
            } else {
                next.add(source);
            }
            return { ...prev, sources: next };
        });
    };

    // 右パネル ソーストグル
    const handleRightSourceToggle = (source: NewsSource) => {
        setRightState(prev => {
            const next = new Set(prev.sources);
            if (next.has(source)) {
                if (next.size > 1) next.delete(source);
            } else {
                next.add(source);
            }
            return { ...prev, sources: next };
        });
    };

    // カテゴリカウント計算
    const getCategoryCounts = (sources: Set<NewsSource>) => {
        const raw: NewsItem[] = [];
        if (data) {
            if (sources.has('Nikkei')) raw.push(...(data.nikkei || []));
            if (sources.has('MinkabuFX')) raw.push(...(data.minkabu || []));
            if (sources.has('Crypto')) raw.push(...(data.crypto || []));
            if (sources.has('Bloomberg')) raw.push(...(data.bloomberg || []));
            if (sources.has('Reuters')) raw.push(...(data.reuters || []));
            if (sources.has('CNN')) raw.push(...(data.cnn || []));
        }
        const counts: Record<NewsCategory, number> = {
            all: raw.length, fx: 0, stocks: 0, bonds: 0, commodities: 0, crypto: 0, economy: 0,
        };
        raw.forEach(i => {
            const cat = categorizeArticle(i.title);
            counts[cat]++;
        });
        return counts;
    };

    const leftCategoryCounts = useMemo(() => getCategoryCounts(leftState.sources), [leftState.sources, data]);
    const rightCategoryCounts = useMemo(() => getCategoryCounts(rightState.sources), [rightState.sources, data]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            {/* 左パネル (Panel A) */}
            <div className="space-y-4">
                <div className="glass-panel p-4 border-l-4 border-blue-500 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            PANEL A — MONITOR
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                            {leftItems.length} ITEMS
                        </span>
                    </div>

                    <SourceToggle
                        activeSources={leftState.sources}
                        onToggle={handleLeftSourceToggle}
                    />

                    <input
                        type="text"
                        placeholder="パネルAを検索..."
                        value={leftState.search}
                        onChange={(e) => setLeftState(p => ({ ...p, search: e.target.value }))}
                        className="search-input text-xs py-1.5"
                    />

                    <CategoryTabs
                        activeCategory={leftState.category}
                        onCategoryChange={(c) => setLeftState(p => ({ ...p, category: c }))}
                        counts={leftCategoryCounts}
                    />
                </div>

                <CompactNewsList
                    items={leftItems}
                    title="パネル A タイムライン"
                    source="mixed"
                    onBookmark={onBookmark}
                    bookmarkedUrls={bookmarkedUrls}
                    readUrls={readUrls}
                    onMarkRead={onMarkRead}
                />
            </div>

            {/* 右パネル (Panel B) */}
            <div className="space-y-4">
                <div className="glass-panel p-4 border-l-4 border-amber-500 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            PANEL B — MONITOR
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                            {rightItems.length} ITEMS
                        </span>
                    </div>

                    <SourceToggle
                        activeSources={rightState.sources}
                        onToggle={handleRightSourceToggle}
                    />

                    <input
                        type="text"
                        placeholder="パネルBを検索..."
                        value={rightState.search}
                        onChange={(e) => setRightState(p => ({ ...p, search: e.target.value }))}
                        className="search-input text-xs py-1.5"
                    />

                    <CategoryTabs
                        activeCategory={rightState.category}
                        onCategoryChange={(c) => setRightState(p => ({ ...p, category: c }))}
                        counts={rightCategoryCounts}
                    />
                </div>

                <CompactNewsList
                    items={rightItems}
                    title="パネル B タイムライン"
                    source="mixed"
                    onBookmark={onBookmark}
                    bookmarkedUrls={bookmarkedUrls}
                    readUrls={readUrls}
                    onMarkRead={onMarkRead}
                />
            </div>
        </div>
    );
}
