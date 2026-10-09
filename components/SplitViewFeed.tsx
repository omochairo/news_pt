'use client';

import React, { useState, useMemo } from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { NewsCategory, categorizeArticle } from '@/lib/categorizer';
import { FeedData, collectBySources, compareByDateDesc, countByCategory } from '@/lib/feed';
import SourceToggle, { ALL_SOURCES } from './SourceToggle';
import CategoryTabs from './CategoryTabs';
import CompactNewsList from './CompactNewsList';

interface SplitViewFeedProps {
    data: FeedData | null;
    onBookmark?: (item: NewsItem) => void;
    bookmarkedUrls?: Set<string>;
    readUrls?: Set<string>;
    onMarkRead?: (url: string) => void;
}

interface FeedPanelProps extends SplitViewFeedProps {
    label: 'A' | 'B';
    initialSources: NewsSource[];
}

// Tailwind はクラス名を静的に拾うので、組み立てずにそのまま書く
const PANEL_STYLES = {
    A: { border: 'border-blue-500', text: 'text-blue-400', dot: 'bg-blue-500' },
    B: { border: 'border-amber-500', text: 'text-amber-400', dot: 'bg-amber-500' },
} as const;

function FeedPanel({ label, initialSources, data, onBookmark, bookmarkedUrls, readUrls, onMarkRead }: FeedPanelProps) {
    const [sources, setSources] = useState<Set<NewsSource>>(() => new Set(initialSources));
    const [category, setCategory] = useState<NewsCategory>('all');
    const [search, setSearch] = useState('');

    const sourceItems = useMemo(() => collectBySources(data, sources), [data, sources]);
    const categoryCounts = useMemo(() => countByCategory(sourceItems), [sourceItems]);

    const items = useMemo(() => {
        let filtered = sourceItems;
        if (search) {
            const query = search.toLowerCase();
            filtered = filtered.filter(i => i.title.toLowerCase().includes(query));
        }
        if (category !== 'all') {
            filtered = filtered.filter(i => categorizeArticle(i.title) === category);
        }
        return [...filtered].sort(compareByDateDesc);
    }, [sourceItems, search, category]);

    // 最後の1媒体は外せない
    const handleSourceToggle = (source: NewsSource) => {
        setSources(prev => {
            const next = new Set(prev);
            if (next.has(source)) {
                if (next.size > 1) next.delete(source);
            } else {
                next.add(source);
            }
            return next;
        });
    };

    const style = PANEL_STYLES[label];

    return (
        <div className="space-y-4">
            <div className={`glass-panel p-4 border-l-4 ${style.border} space-y-3`}>
                <div className="flex items-center justify-between">
                    <span className={`font-mono font-bold text-xs ${style.text} uppercase tracking-widest flex items-center gap-1.5`}>
                        <span className={`w-2 h-2 rounded-full ${style.dot} animate-pulse`} />
                        PANEL {label} — MONITOR
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                        {items.length} ITEMS
                    </span>
                </div>

                <SourceToggle activeSources={sources} onToggle={handleSourceToggle} />

                <input
                    type="text"
                    placeholder={`パネル${label}を検索...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="search-input text-xs py-1.5"
                />

                <CategoryTabs activeCategory={category} onCategoryChange={setCategory} counts={categoryCounts} />
            </div>

            <CompactNewsList
                items={items}
                title={`パネル ${label} タイムライン`}
                source="mixed"
                onBookmark={onBookmark}
                bookmarkedUrls={bookmarkedUrls}
                readUrls={readUrls}
                onMarkRead={onMarkRead}
            />
        </div>
    );
}

export default function SplitViewFeed(props: SplitViewFeedProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
            <FeedPanel {...props} label="A" initialSources={ALL_SOURCES.filter(s => s !== 'Crypto')} />
            <FeedPanel {...props} label="B" initialSources={['Crypto']} />
        </div>
    );
}
