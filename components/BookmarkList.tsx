'use client';

import React from 'react';
import { BookmarkedItem, removeBookmark } from '@/lib/bookmarks';

interface BookmarkListProps {
    bookmarks: BookmarkedItem[];
    onUpdate: (updated: BookmarkedItem[]) => void;
    onClose: () => void;
}

export default function BookmarkList({ bookmarks, onUpdate, onClose }: BookmarkListProps) {
    const handleRemove = (url: string) => {
        const updated = removeBookmark(url);
        onUpdate(updated);
    };

    return (
        <div className="bookmark-overlay" onClick={onClose}>
            <div className="bookmark-panel glass-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>★</span> ブックマーク
                        <span className="text-xs font-mono text-[var(--text-secondary)] ml-2">{bookmarks.length} 件</span>
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-[var(--card-border)] transition-colors text-[var(--text-secondary)] hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Items */}
                <div className="bookmark-items">
                    {bookmarks.length === 0 ? (
                        <div className="px-6 py-12 text-center text-[var(--text-secondary)]">
                            <p className="text-lg mb-2">ブックマークはまだありません</p>
                            <p className="text-sm opacity-60">記事の☆をクリックして保存しましょう</p>
                        </div>
                    ) : (
                        bookmarks.map((bm) => (
                            <div key={bm.url} className="bookmark-item group">
                                <a
                                    href={bm.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-6 py-3 hover:bg-white/[0.02] transition-colors"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span
                                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                            style={{
                                                backgroundColor: bm.source === 'Bloomberg' ? 'var(--accent-bloomberg)' : bm.source === 'Reuters' ? 'var(--accent-reuters)' : 'var(--accent-cnn)'
                                            }}
                                        >
                                            {bm.source}
                                        </span>
                                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                                            {new Date(bm.savedAt).toLocaleDateString('ja-JP')}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-medium leading-snug group-hover:text-white transition-colors">
                                        {bm.title}
                                    </h4>
                                </a>
                                <button
                                    onClick={() => handleRemove(bm.url)}
                                    className="bookmark-remove-btn"
                                    title="削除"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
