'use client';

import React, { useState, useMemo } from 'react';
import { DailyHistory } from '@/lib/history';
import { NewsItem } from '@/lib/parser';

interface HistoryListProps {
    historyData: DailyHistory[];
    onClose: () => void;
}

export default function HistoryList({ historyData, onClose }: HistoryListProps) {
    const sortedDates = useMemo(() => {
        return historyData.map(h => h.date).sort((a, b) => b.localeCompare(a));
    }, [historyData]);

    const [selectedDate, setSelectedDate] = useState<string | null>(
        sortedDates.length > 0 ? sortedDates[0] : null
    );

    const activeRecord = useMemo(() => {
        return historyData.find(h => h.date === selectedDate);
    }, [historyData, selectedDate]);

    return (
        <div className="bookmark-overlay" onClick={onClose} style={{ zIndex: 60 }}>
            <div className="bookmark-panel glass-panel" style={{ width: '800px', maxWidth: '95vw', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-[var(--card-border)] flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>🗓️</span> 記事アーカイブ
                        <span className="text-xs font-mono text-[var(--text-secondary)] ml-2">過去 {historyData.length} 日分</span>
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

                <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
                    {/* Sidebar: Dates */}
                    <div className="md:w-1/4 border-b md:border-b-0 md:border-r border-[var(--card-border)] overflow-x-auto md:overflow-y-auto bg-black/20 flex md:flex-col shrink-0">
                        {sortedDates.length === 0 ? (
                            <div className="p-4 text-xs text-center text-[var(--text-secondary)]">履歴がありません</div>
                        ) : (
                            sortedDates.map(date => {
                                const count = historyData.find(h => h.date === date)?.items.length || 0;
                                return (
                                    <button
                                        key={date}
                                        onClick={() => setSelectedDate(date)}
                                        className={`w-full text-left px-4 py-3 border-b border-[var(--card-border)] transition-colors flex items-center justify-between ${
                                            selectedDate === date ? 'bg-[var(--card-border)] text-white' : 'hover:bg-white/5 text-[var(--text-secondary)]'
                                        }`}
                                    >
                                        <span className="font-mono text-sm">{date}</span>
                                        <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full">{count}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Main Content: News List */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {!activeRecord ? (
                            <div className="h-full flex items-center justify-center text-[var(--text-secondary)]">
                                日付を選択してください
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <h4 className="text-sm font-bold text-white mb-4 pl-2 border-l-2 border-white">{activeRecord.date} の全取得記事</h4>
                                {activeRecord.items.map((item, idx) => (
                                    <a
                                        key={`${item.url}-${idx}`}
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block p-4 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] transition-colors group"
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <span
                                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                                                style={{
                                                    backgroundColor: item.source === 'Bloomberg' ? 'var(--accent-bloomberg)' : item.source === 'Reuters' ? 'var(--accent-reuters)' : 'var(--accent-cnn)'
                                                }}
                                            >
                                                {item.source}
                                            </span>
                                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                                                {item.time || 'N/A'}
                                            </span>
                                        </div>
                                        <h4 className="text-sm font-medium leading-snug group-hover:text-white transition-colors">
                                            {item.title}
                                        </h4>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
