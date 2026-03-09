'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { NewsCategory, categorizeArticle, CATEGORIES } from '@/lib/categorizer';
import { addBookmark, removeBookmark, getBookmarks, isBookmarked as checkBookmarked, BookmarkedItem } from '@/lib/bookmarks';
import MarketTicker from '@/components/MarketTicker';
import CategoryTabs from '@/components/CategoryTabs';
import TopStory from '@/components/TopStory';
import CompactNewsList from '@/components/CompactNewsList';
import BookmarkList from '@/components/BookmarkList';
import SourceToggle, { ALL_SOURCES } from '@/components/SourceToggle';

interface NewsData {
    bloomberg: NewsItem[];
    reuters: NewsItem[];
    cnn: NewsItem[];
    updatedAt: string;
}

export default function Home() {
    const [data, setData] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
    const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [activeSources, setActiveSources] = useState<Set<NewsSource>>(new Set(ALL_SOURCES));

    useEffect(() => {
        setBookmarks(getBookmarks());
    }, []);

    const bookmarkedUrls = useMemo(() => new Set(bookmarks.map(b => b.url)), [bookmarks]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/news');
            if (!res.ok) throw new Error('Failed to fetch');
            const json = await res.json();
            setData(json);
            setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // ソーストグル
    const handleSourceToggle = (source: NewsSource) => {
        setActiveSources(prev => {
            const next = new Set(prev);
            if (next.has(source)) {
                // 最低1つは有効にする
                if (next.size > 1) next.delete(source);
            } else {
                next.add(source);
            }
            return next;
        });
    };

    // フィルタリング（検索 + カテゴリ）
    const filterItems = useCallback((items: NewsItem[]) => {
        let filtered = items;
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(item => item.title.toLowerCase().includes(lowerQuery));
        }
        if (activeCategory !== 'all') {
            filtered = filtered.filter(item => categorizeArticle(item.title) === activeCategory);
        }
        return filtered;
    }, [searchQuery, activeCategory]);

    // 全ソースを統合して時間順にソート（タイムライン）
    const timelineItems = useMemo(() => {
        if (!data) return [];
        const all: NewsItem[] = [];
        if (activeSources.has('Bloomberg')) all.push(...(data.bloomberg || []));
        if (activeSources.has('Reuters')) all.push(...(data.reuters || []));
        if (activeSources.has('CNN')) all.push(...(data.cnn || []));

        const filtered = filterItems(all);

        // 時間順にソート（降順: 新しいもの順）
        return filtered.sort((a, b) => {
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeB.localeCompare(timeA);
        });
    }, [data, activeSources, filterItems]);

    // カテゴリごとのカウント（アクティブソースのみ）
    const categoryCounts = useMemo(() => {
        const allRaw: NewsItem[] = [];
        if (data) {
            if (activeSources.has('Bloomberg')) allRaw.push(...(data.bloomberg || []));
            if (activeSources.has('Reuters')) allRaw.push(...(data.reuters || []));
            if (activeSources.has('CNN')) allRaw.push(...(data.cnn || []));
        }
        const counts: Record<NewsCategory, number> = {
            all: allRaw.length,
            fx: 0, stocks: 0, bonds: 0, commodities: 0, crypto: 0, economy: 0,
        };
        allRaw.forEach(item => {
            const cat = categorizeArticle(item.title);
            counts[cat]++;
        });
        return counts;
    }, [data, activeSources]);

    // トップストーリー
    const topStory = timelineItems[0] || null;
    const remainingItems = timelineItems.slice(1);

    // ブックマーク操作
    const handleBookmark = (item: NewsItem) => {
        if (checkBookmarked(item.url)) {
            setBookmarks(removeBookmark(item.url));
        } else {
            setBookmarks(addBookmark({ url: item.url, title: item.title, source: item.source }));
        }
    };

    return (
        <>
            <MarketTicker />

            <main className="container min-h-screen py-6">
                <header className="mb-6 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-1">
                                Vantage Point
                            </h1>
                            <p className="text-[var(--text-secondary)] text-sm font-mono uppercase tracking-widest">
                                Global Market Intelligence Dashboard
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowBookmarks(true)}
                                className="header-action-btn"
                                title="ブックマーク"
                            >
                                <span>★</span>
                                {bookmarks.length > 0 && (
                                    <span className="bookmark-badge">{bookmarks.length}</span>
                                )}
                            </button>

                            <div className="text-right hidden md:block">
                                <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono">LAST SYNC</div>
                                <div className="font-mono text-lg">{lastUpdated || '--:--:--'}</div>
                            </div>

                            <button
                                onClick={fetchNews}
                                disabled={loading}
                                className="header-action-btn"
                                title="Refresh News"
                            >
                                <svg
                                    className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Source Toggle */}
                    <SourceToggle
                        activeSources={activeSources}
                        onToggle={handleSourceToggle}
                    />

                    {/* Search */}
                    <div className="relative max-w-xl">
                        <input
                            type="text"
                            placeholder="ヘッドラインを検索 (例: FX, 日銀, 利上げ)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    {/* Category Tabs */}
                    <CategoryTabs
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        counts={categoryCounts}
                    />
                </header>

                {/* Main content: Timeline */}
                {loading && !data ? (
                    <div className="space-y-4">
                        <div className="glass-panel h-64 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Top Story */}
                        {topStory && (
                            <TopStory
                                item={topStory}
                                onBookmark={handleBookmark}
                                isBookmarked={bookmarkedUrls.has(topStory.url)}
                            />
                        )}

                        {/* Unified timeline list */}
                        <CompactNewsList
                            items={remainingItems}
                            title={`タイムライン — ${activeSources.size === ALL_SOURCES.length ? '全ソース' : Array.from(activeSources).join(' + ')}`}
                            source="mixed"
                            onBookmark={handleBookmark}
                            bookmarkedUrls={bookmarkedUrls}
                        />
                    </div>
                )}
            </main>

            {showBookmarks && (
                <BookmarkList
                    bookmarks={bookmarks}
                    onUpdate={setBookmarks}
                    onClose={() => setShowBookmarks(false)}
                />
            )}
        </>
    );
}
