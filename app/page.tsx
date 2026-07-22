'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { NewsItem, NewsSource } from '@/lib/parser';
import { NewsCategory, categorizeArticle } from '@/lib/categorizer';
import { addBookmark, removeBookmark, getBookmarks, isBookmarked as checkBookmarked, BookmarkedItem } from '@/lib/bookmarks';
import { extractTrendKeywords, TrendKeyword } from '@/lib/keywords';
import MarketTicker from '@/components/MarketTicker';
import CategoryTabs from '@/components/CategoryTabs';
import TopStory from '@/components/TopStory';
import CompactNewsList from '@/components/CompactNewsList';
import TerminalNewsGrid from '@/components/TerminalNewsGrid';
import BookmarkList from '@/components/BookmarkList';
import SourceToggle, { ALL_SOURCES } from '@/components/SourceToggle';
import HistoryList from '@/components/HistoryList';
import { saveToDailyHistory, getDailyHistory, DailyHistory } from '@/lib/history';

interface NewsData {
    nikkei?: NewsItem[];
    minkabu?: NewsItem[];
    bloomberg?: NewsItem[];
    reuters?: NewsItem[];
    cnn?: NewsItem[];
    crypto?: NewsItem[];
    updatedAt: string;
}

type ViewMode = 'modern' | 'terminal';
const VIEWMODE_STORAGE_KEY = 'vantage-point-viewmode';

export default function Home() {
    const [data, setData] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
    const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<DailyHistory[]>([]);
    const [activeSources, setActiveSources] = useState<Set<NewsSource>>(new Set(ALL_SOURCES));
    const [viewMode, setViewMode] = useState<ViewMode>('modern');

    useEffect(() => {
        setBookmarks(getBookmarks());
        setHistoryData(getDailyHistory());

        // ローカルストレージから表示モードを復元
        const savedViewMode = localStorage.getItem(VIEWMODE_STORAGE_KEY) as ViewMode;
        if (savedViewMode === 'terminal' || savedViewMode === 'modern') {
            setViewMode(savedViewMode);
        }
    }, []);

    const toggleViewMode = () => {
        const nextMode = viewMode === 'modern' ? 'terminal' : 'modern';
        setViewMode(nextMode);
        localStorage.setItem(VIEWMODE_STORAGE_KEY, nextMode);
    };

    const bookmarkedUrls = useMemo(() => new Set(bookmarks.map(b => b.url)), [bookmarks]);

    const fetchNews = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/news');
            if (!res.ok) throw new Error('Failed to fetch');
            const json: NewsData = await res.json();
            setData(json);
            setLastUpdated(new Date().toLocaleTimeString('ja-JP'));
            
            // 取得した全記事をローカル履歴に保存
            const allFetched = [
                ...(json.nikkei || []),
                ...(json.minkabu || []),
                ...(json.crypto || []),
                ...(json.bloomberg || []),
                ...(json.reuters || []),
                ...(json.cnn || []),
            ];
            saveToDailyHistory(allFetched);
            setHistoryData(getDailyHistory());
        } catch (error) {
            console.error('Error fetching news:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        const interval = setInterval(fetchNews, 5 * 60 * 1000); // 5分ごとに更新
        return () => clearInterval(interval);
    }, []);

    // ソーストグル
    const handleSourceToggle = (source: NewsSource) => {
        setActiveSources(prev => {
            const next = new Set(prev);
            if (next.has(source)) {
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
        if (activeSources.has('Nikkei')) all.push(...(data.nikkei || []));
        if (activeSources.has('MinkabuFX')) all.push(...(data.minkabu || []));
        if (activeSources.has('Crypto')) all.push(...(data.crypto || []));
        if (activeSources.has('Bloomberg')) all.push(...(data.bloomberg || []));
        if (activeSources.has('Reuters')) all.push(...(data.reuters || []));
        if (activeSources.has('CNN')) all.push(...(data.cnn || []));

        const filtered = filterItems(all);

        return filtered.sort((a, b) => {
            if (a.isoDate && b.isoDate) {
                return new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime();
            }
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeB.localeCompare(timeA);
        });
    }, [data, activeSources, filterItems]);

    // 全アイテム一覧（トレンド抽出用）
    const allRawItems = useMemo(() => {
        if (!data) return [];
        return [
            ...(data.nikkei || []),
            ...(data.minkabu || []),
            ...(data.crypto || []),
            ...(data.bloomberg || []),
            ...(data.reuters || []),
            ...(data.cnn || []),
        ];
    }, [data]);

    // トレンドキーワード抽出
    const trendKeywords: TrendKeyword[] = useMemo(() => {
        return extractTrendKeywords(allRawItems, 10);
    }, [allRawItems]);

    // カテゴリごとのカウント
    const categoryCounts = useMemo(() => {
        const allRaw: NewsItem[] = [];
        if (data) {
            if (activeSources.has('Nikkei')) allRaw.push(...(data.nikkei || []));
            if (activeSources.has('MinkabuFX')) allRaw.push(...(data.minkabu || []));
            if (activeSources.has('Crypto')) allRaw.push(...(data.crypto || []));
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

    // トレンドキーワードタップ時の切り替え
    const handleKeywordClick = (word: string) => {
        if (searchQuery === word) {
            setSearchQuery('');
        } else {
            setSearchQuery(word);
        }
    };

    return (
        <>
            <MarketTicker />

            <main className="container min-h-screen py-6">
                <header className="mb-6 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-1">
                                Vantage Point
                            </h1>
                            <p className="text-[var(--text-secondary)] text-xs md:text-sm font-mono uppercase tracking-widest hidden md:block">
                                Global Market Intelligence Dashboard
                            </p>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                            {/* View Mode Toggle Button */}
                            <button
                                onClick={toggleViewMode}
                                className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                    viewMode === 'terminal'
                                        ? 'bg-[#00ff66]/10 text-[#00ff66] border-[#00ff66]/50 shadow-[0_0_12px_rgba(0,255,102,0.25)]'
                                        : 'bg-[var(--card-bg)] text-gray-300 border-[var(--card-border)] hover:border-gray-500'
                                }`}
                                title="表示モード切替 (プロ仕様高密度ターミナル表示 / モダン表示)"
                            >
                                <span>{viewMode === 'terminal' ? '⚡ TERMINAL' : '📱 MODERN'}</span>
                            </button>

                            <button
                                onClick={() => setShowHistory(true)}
                                className="header-action-btn"
                                title="過去の記事アーカイブ"
                            >
                                <span>🗓️</span>
                            </button>

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

                    {/* Search & Trend Cloud */}
                    <div className="space-y-2">
                        <div className="relative w-full max-w-xl">
                            <input
                                type="text"
                                placeholder="ヘッドラインを検索 (例: FX, 日銀, 利上げ, 為替)..."
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

                        {/* Trend Keywords Cloud */}
                        {trendKeywords.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                                <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 mr-1">
                                    🔥 TRENDS:
                                </span>
                                {trendKeywords.map((kw) => {
                                    const isSelected = searchQuery === kw.word;
                                    return (
                                        <button
                                            key={kw.word}
                                            onClick={() => handleKeywordClick(kw.word)}
                                            className={`px-2.5 py-0.5 rounded-full text-xs transition-all font-mono ${
                                                isSelected
                                                    ? 'bg-amber-500 text-black font-bold shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                                    : 'bg-[var(--card-bg)] text-gray-300 border border-[var(--card-border)] hover:border-amber-500/50 hover:text-amber-300'
                                            }`}
                                        >
                                            #{kw.word}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Category Tabs */}
                    <CategoryTabs
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        counts={categoryCounts}
                    />
                </header>

                {/* Main content: Timeline (Switchable between Modern and Terminal) */}
                {loading && !data ? (
                    <div className="space-y-4">
                        <div className="glass-panel h-64 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                    </div>
                ) : viewMode === 'terminal' ? (
                    /* TERMINAL HIGH-DENSITY MODE */
                    <TerminalNewsGrid
                        items={timelineItems}
                        onBookmark={handleBookmark}
                        bookmarkedUrls={bookmarkedUrls}
                    />
                ) : (
                    /* MODERN CARD MODE */
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

            {/* Bookmarks Modal */}
            {showBookmarks && (
                <BookmarkList
                    bookmarks={bookmarks}
                    onUpdate={setBookmarks}
                    onClose={() => setShowBookmarks(false)}
                />
            )}

            {/* History Modal */}
            {showHistory && (
                <HistoryList
                    historyData={historyData}
                    onClose={() => setShowHistory(false)}
                />
            )}
        </>
    );
}
