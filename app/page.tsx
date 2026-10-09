'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { NewsItem, NewsSource } from '@/lib/parser';
import { NewsCategory, categorizeArticle } from '@/lib/categorizer';
import { addBookmark, removeBookmark, getBookmarks, isBookmarked as checkBookmarked, BookmarkedItem } from '@/lib/bookmarks';
import { extractTrendKeywords, TrendKeyword } from '@/lib/keywords';
import { getReadUrls, markAsRead } from '@/lib/read-status';
import MarketTicker from '@/components/MarketTicker';
import { MarketDataProvider } from '@/lib/market-context';
import CategoryTabs from '@/components/CategoryTabs';
import TopStory from '@/components/TopStory';
import CompactNewsList from '@/components/CompactNewsList';
import TerminalNewsGrid from '@/components/TerminalNewsGrid';
import SplitViewFeed from '@/components/SplitViewFeed';
import BookmarkList from '@/components/BookmarkList';
import SourceToggle, { ALL_SOURCES } from '@/components/SourceToggle';
import HistoryList from '@/components/HistoryList';
import EconomicCalendar from '@/components/EconomicCalendar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { saveToDailyHistory, getDailyHistory, DailyHistory } from '@/lib/history';
import { compareByDateDesc } from '@/lib/feed';
import { checkPaywall } from '@/lib/paywall';

interface NewsData {
    nikkei?: NewsItem[];
    minkabu?: NewsItem[];
    bloomberg?: NewsItem[];
    reuters?: NewsItem[];
    cnn?: NewsItem[];
    crypto?: NewsItem[];
    updatedAt: string;
}

type ViewMode = 'modern' | 'terminal' | 'split';
const VIEWMODE_STORAGE_KEY = 'vantage-point-viewmode';
const UNREAD_ONLY_STORAGE_KEY = 'vantage-point-unread-only';
const HIDE_PAYWALL_STORAGE_KEY = 'vantage-point-hide-paywall';
const NEWS_REFRESH_MS = 5 * 60 * 1000;
// タブ・アプリに戻ってきたとき、これより古ければ取り直す
const STALE_ON_RETURN_MS = 60 * 1000;

export default function Home() {
    const [data, setData] = useState<NewsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<NewsCategory>('all');
    const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
    const [readUrls, setReadUrls] = useState<Set<string>>(new Set());
    const [showBookmarks, setShowBookmarks] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showCalendar, setShowCalendar] = useState(false);
    const [historyData, setHistoryData] = useState<DailyHistory[]>([]);
    const [activeSources, setActiveSources] = useState<Set<NewsSource>>(new Set(ALL_SOURCES));
    const [viewMode, setViewMode] = useState<ViewMode>('modern');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [hidePaywall, setHidePaywall] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const lastFetchRef = useRef(0);

    useEffect(() => {
        setBookmarks(getBookmarks());
        setHistoryData(getDailyHistory());
        setReadUrls(getReadUrls());

        // ローカルストレージから表示モードを復元
        const savedViewMode = localStorage.getItem(VIEWMODE_STORAGE_KEY) as ViewMode;
        if (savedViewMode === 'terminal' || savedViewMode === 'modern' || savedViewMode === 'split') {
            setViewMode(savedViewMode);
        }
        try {
            setUnreadOnly(localStorage.getItem(UNREAD_ONLY_STORAGE_KEY) === '1');
            setHidePaywall(localStorage.getItem(HIDE_PAYWALL_STORAGE_KEY) === '1');
        } catch {
            // localStorage が使えない環境では既定値のまま
        }
    }, []);

    const toggleUnreadOnly = () => {
        setUnreadOnly(prev => {
            try {
                localStorage.setItem(UNREAD_ONLY_STORAGE_KEY, prev ? '0' : '1');
            } catch {
                // 保存できなくても表示の切り替えは効かせる
            }
            return !prev;
        });
    };

    const toggleHidePaywall = () => {
        setHidePaywall(prev => {
            try {
                localStorage.setItem(HIDE_PAYWALL_STORAGE_KEY, prev ? '0' : '1');
            } catch {
                // 保存できなくても表示の切り替えは効かせる
            }
            return !prev;
        });
    };

    // 下にスクロールしたら「先頭へ戻る」ボタンを出す
    useEffect(() => {
        const onScroll = () => setShowScrollTop(window.scrollY > 800);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const changeViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        localStorage.setItem(VIEWMODE_STORAGE_KEY, mode);
    };

    const bookmarkedUrls = useMemo(() => new Set(bookmarks.map(b => b.url)), [bookmarks]);

    const handleMarkRead = (url: string) => {
        setReadUrls(markAsRead(url));
    };

    // refresh は更新ボタンから。ブラウザと CDN のキャッシュ（5 分）を通さず、サーバーに取り直させる
    const fetchNews = async (refresh = false) => {
        lastFetchRef.current = Date.now();
        setLoading(true);
        try {
            const res = refresh ? await fetch('/api/news?refresh=true', { cache: 'no-store' }) : await fetch('/api/news');
            if (!res.ok) throw new Error('Failed to fetch');
            const json: NewsData = await res.json();
            setData(json);
            // 受け取った時刻ではなく、サーバーが取得した時刻（キャッシュが返っても「今」に見えないように）
            setLastUpdated(new Date(json.updatedAt).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' }));
            
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
        // 5分ごとに更新。裏に回っている間は取りに行かず、戻ってきたときに古ければ取り直す
        // （スマホでアプリに戻ったとき、次の定期更新まで古い記事が出続けていた）
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') fetchNews();
        }, NEWS_REFRESH_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > STALE_ON_RETURN_MS) {
                fetchNews();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
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
        if (unreadOnly) {
            filtered = filtered.filter(item => !readUrls.has(item.url));
        }
        return filtered;
    }, [searchQuery, activeCategory, unreadOnly, readUrls]);

    // 有料記事を隠す設定のときは、どの表示モードにも出さない（件数・トレンド語も含めて）
    const shownData = useMemo(() => {
        if (!data || !hidePaywall) return data;
        const free = (items?: NewsItem[]) => items?.filter(item => !checkPaywall(item).isPaywall);
        return {
            ...data,
            nikkei: free(data.nikkei), minkabu: free(data.minkabu), bloomberg: free(data.bloomberg),
            reuters: free(data.reuters), cnn: free(data.cnn), crypto: free(data.crypto),
        };
    }, [data, hidePaywall]);

    // 全ソースを統合して時間順にソート（タイムライン）
    const timelineItems = useMemo(() => {
        if (!shownData) return [];
        const all: NewsItem[] = [];
        if (activeSources.has('Nikkei')) all.push(...(shownData.nikkei || []));
        if (activeSources.has('MinkabuFX')) all.push(...(shownData.minkabu || []));
        if (activeSources.has('Crypto')) all.push(...(shownData.crypto || []));
        if (activeSources.has('Bloomberg')) all.push(...(shownData.bloomberg || []));
        if (activeSources.has('Reuters')) all.push(...(shownData.reuters || []));
        if (activeSources.has('CNN')) all.push(...(shownData.cnn || []));

        const filtered = filterItems(all);

        return filtered.sort(compareByDateDesc);
    }, [shownData, activeSources, filterItems]);

    // 全アイテム一覧（トレンド抽出用）
    const allRawItems = useMemo(() => {
        if (!shownData) return [];
        return [
            ...(shownData.nikkei || []),
            ...(shownData.minkabu || []),
            ...(shownData.crypto || []),
            ...(shownData.bloomberg || []),
            ...(shownData.reuters || []),
            ...(shownData.cnn || []),
        ];
    }, [shownData]);

    // トレンドキーワード抽出
    const trendKeywords: TrendKeyword[] = useMemo(() => {
        return extractTrendKeywords(allRawItems, 10);
    }, [allRawItems]);

    // カテゴリごとのカウント
    const categoryCounts = useMemo(() => {
        const allRaw: NewsItem[] = [];
        if (shownData) {
            if (activeSources.has('Nikkei')) allRaw.push(...(shownData.nikkei || []));
            if (activeSources.has('MinkabuFX')) allRaw.push(...(shownData.minkabu || []));
            if (activeSources.has('Crypto')) allRaw.push(...(shownData.crypto || []));
            if (activeSources.has('Bloomberg')) allRaw.push(...(shownData.bloomberg || []));
            if (activeSources.has('Reuters')) allRaw.push(...(shownData.reuters || []));
            if (activeSources.has('CNN')) allRaw.push(...(shownData.cnn || []));
        }
        const counts: Record<NewsCategory, number> = {
            all: allRaw.length,
            fx: 0, stocks: 0, bonds: 0, commodities: 0, crypto: 0, economy: 0,
        };
        allRaw.forEach(item => {
            const cat = categorizeArticle(item.title);
            if (cat !== 'all') counts[cat]++;
        });
        return counts;
    }, [shownData, activeSources]);

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
        <MarketDataProvider>
            <MarketTicker />

            <main className="container min-h-screen py-6">
                <header className="mb-5 md:mb-6 space-y-3 md:space-y-5">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 md:gap-4">
                        <div>
                            <h1 className="text-2xl md:text-5xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent mb-1">
                                Vantage Point
                            </h1>
                            <p className="text-[var(--text-secondary)] text-xs md:text-sm font-mono uppercase tracking-widest hidden md:block">
                                Global Market Intelligence Dashboard
                            </p>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                            {/* View Mode Switcher */}
                            <div className="flex items-center rounded-lg p-0.5 bg-[var(--card-bg)] border border-[var(--card-border)] font-mono text-xs">
                                <button
                                    onClick={() => changeViewMode('modern')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${
                                        viewMode === 'modern' ? 'bg-blue-600 text-white font-bold shadow' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                    title="モダンカード表示"
                                    aria-label="モダンカード表示"
                                >
                                    📱<span className="hidden sm:inline"> MODERN</span>
                                </button>
                                <button
                                    onClick={() => changeViewMode('terminal')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${
                                        viewMode === 'terminal' ? 'bg-[#00ff66]/20 text-[#00ff66] font-bold shadow border border-[#00ff66]/40' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                    title="プロ仕様高密度ターミナル表示"
                                    aria-label="ターミナル表示"
                                >
                                    ⚡<span className="hidden sm:inline"> TERMINAL</span>
                                </button>
                                <button
                                    onClick={() => changeViewMode('split')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${
                                        viewMode === 'split' ? 'bg-amber-500/20 text-amber-300 font-bold shadow border border-amber-500/40' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                                    title="画面分割マルチビュー"
                                    aria-label="画面分割表示"
                                >
                                    📑<span className="hidden sm:inline"> DUAL VIEW</span>
                                </button>
                            </div>

                            {/* Economic Calendar Button */}
                            <button
                                onClick={() => setShowCalendar(true)}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors font-semibold flex items-center gap-1 text-xs"
                                title="経済指標・重要イベントカレンダー"
                            >
                                <span>📅</span>
                                <span className="hidden sm:inline">経済カレンダー</span>
                            </button>

                            <Link
                                href="/markets"
                                className="header-action-btn text-xs px-2.5 gap-1"
                                title="世界の市場"
                                aria-label="世界の市場"
                            >
                                <span>🌐</span>
                                <span className="hidden sm:inline">世界の市場</span>
                            </Link>

                            {/* PWA Install Prompt */}
                            <PWAInstallPrompt />

                            <button
                                onClick={() => setShowHistory(true)}
                                className="header-action-btn"
                                title="過去の記事アーカイブ"
                                aria-label="過去の記事アーカイブ"
                            >
                                <span>🕘</span>
                            </button>

                            <button
                                onClick={() => setShowBookmarks(true)}
                                className="header-action-btn"
                                title="ブックマーク"
                                aria-label="ブックマーク"
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
                                onClick={() => fetchNews(true)}
                                disabled={loading}
                                className="header-action-btn"
                                title={lastUpdated ? `ニュースを更新（最終更新 ${lastUpdated}）` : 'ニュースを更新'}
                                aria-label="ニュースを更新"
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

                    {/* Single View Mode の場合の統合フィルター */}
                    {viewMode !== 'split' && (
                        <>
                            {/* Source Toggle */}
                            <SourceToggle
                                activeSources={activeSources}
                                onToggle={handleSourceToggle}
                            />

                            {/* Search & Trend Cloud */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
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
                                <button
                                    onClick={toggleUnreadOnly}
                                    aria-pressed={unreadOnly}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                                        unreadOnly
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                                            : 'bg-[var(--card-bg)] text-gray-400 border-[var(--card-border)] hover:text-gray-200'
                                    }`}
                                    title="既読の記事を隠す"
                                >
                                    {unreadOnly ? '✓ 未読のみ' : '未読のみ'}
                                </button>
                                <button
                                    onClick={toggleHidePaywall}
                                    aria-pressed={!hidePaywall}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                                        hidePaywall
                                            ? 'bg-[var(--card-bg)] text-gray-400 border-[var(--card-border)] hover:text-gray-200 line-through'
                                            : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                    }`}
                                    title={hidePaywall ? '有料記事を表示する' : '有料記事を隠す'}
                                >
                                    {hidePaywall ? '🔒 有料 OFF' : '🔒 有料 ON'}
                                </button>
                                </div>

                                {/* Trend Keywords Cloud */}
                                {trendKeywords.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar md:flex-wrap md:overflow-visible text-xs pt-1">
                                        <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1 mr-1 flex-shrink-0">
                                            🔥 TRENDS:
                                        </span>
                                        {trendKeywords.map((kw) => {
                                            const isSelected = searchQuery === kw.word;
                                            return (
                                                <button
                                                    key={kw.word}
                                                    onClick={() => handleKeywordClick(kw.word)}
                                                    className={`px-2.5 py-0.5 rounded-full text-xs transition-all font-mono whitespace-nowrap flex-shrink-0 ${
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
                        </>
                    )}
                </header>

                {/* Main content: Timeline (Switchable between Modern, Terminal, and Split) */}
                {loading && !data ? (
                    <div className="space-y-4">
                        <div className="glass-panel h-64 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                        <div className="glass-panel h-48 loading-pulse" />
                    </div>
                ) : viewMode === 'split' ? (
                    /* DUAL PANEL SPLIT VIEW MODE */
                    <SplitViewFeed
                        data={shownData}
                        onBookmark={handleBookmark}
                        bookmarkedUrls={bookmarkedUrls}
                        readUrls={readUrls}
                        onMarkRead={handleMarkRead}
                    />
                ) : viewMode === 'terminal' ? (
                    /* TERMINAL HIGH-DENSITY MODE */
                    <TerminalNewsGrid
                        items={timelineItems}
                        onBookmark={handleBookmark}
                        bookmarkedUrls={bookmarkedUrls}
                        readUrls={readUrls}
                        onMarkRead={handleMarkRead}
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
                                isRead={readUrls.has(topStory.url)}
                                onMarkRead={handleMarkRead}
                            />
                        )}

                        {/* Unified timeline list */}
                        <CompactNewsList
                            items={remainingItems}
                            title={`タイムライン — ${activeSources.size === ALL_SOURCES.length ? '全ソース' : Array.from(activeSources).join(' + ')}`}
                            source="mixed"
                            onBookmark={handleBookmark}
                            bookmarkedUrls={bookmarkedUrls}
                            readUrls={readUrls}
                            onMarkRead={handleMarkRead}
                        />
                    </div>
                )}
            </main>

            {/* 先頭へ戻る */}
            {showScrollTop && (
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] text-gray-200 shadow-lg hover:bg-white/10 transition-colors"
                    style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
                    title="ページの先頭へ"
                    aria-label="ページの先頭へ"
                >
                    ↑
                </button>
            )}

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

            {/* Economic Calendar Modal */}
            {showCalendar && (
                <EconomicCalendar
                    onClose={() => setShowCalendar(false)}
                />
            )}
        </MarketDataProvider>
    );
}
