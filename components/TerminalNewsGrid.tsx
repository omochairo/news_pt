'use client';

import React from 'react';
import { NewsItem } from '@/lib/parser';
import { scoreImportance } from '@/lib/importance';
import { categorizeArticle, getCategoryConfig } from '@/lib/categorizer';
import { detectRelatedSymbol } from '@/lib/market-data';
import Sparkline from './Sparkline';

interface TerminalNewsGridProps {
    items: NewsItem[];
    onBookmark?: (item: NewsItem) => void;
    bookmarkedUrls?: Set<string>;
}

export default function TerminalNewsGrid({ items, onBookmark, bookmarkedUrls }: TerminalNewsGridProps) {
    return (
        <div className="terminal-grid-wrapper glass-panel border border-[#00ff66]/30 font-mono text-xs overflow-x-auto">
            <div className="bg-[#0c1017] px-4 py-2 border-b border-[#00ff66]/20 flex items-center justify-between text-[#00ff66]">
                <div className="flex items-center gap-2 font-bold tracking-widest uppercase">
                    <span className="w-2 h-2 rounded-full bg-[#00ff66] animate-pulse" />
                    TERMINAL HIGH-DENSITY FEED — PRO MODE
                </div>
                <div className="text-[10px] opacity-70">
                    TOTAL: {items.length} RECORDS
                </div>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-[#1e293b] text-gray-400 bg-[#0f172a]/50 text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-16">TIME</th>
                        <th className="py-2.5 px-3 w-24">SOURCE</th>
                        <th className="py-2.5 px-3 w-24">CAT</th>
                        <th className="py-2.5 px-3">HEADLINE</th>
                        <th className="py-2.5 px-3 w-48">MARKET IMPACT</th>
                        <th className="py-2.5 px-3 w-20 text-center">ACTION</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]/60">
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-8 text-center text-gray-500 font-mono">
                                NO NEWS DATA AVAILABLE IN TERMINAL BUFFER
                            </td>
                        </tr>
                    ) : (
                        items.map((item, idx) => {
                            const importance = scoreImportance(item.title);
                            const category = categorizeArticle(item.title);
                            const catConfig = getCategoryConfig(category);
                            const marketSymbol = detectRelatedSymbol(item.title);
                            const isBm = bookmarkedUrls?.has(item.url);

                            const isBreaking = importance === 'breaking';
                            const isHigh = importance === 'high';

                            return (
                                <tr
                                    key={`${item.url}-${idx}`}
                                    className={`hover:bg-[#1e293b]/50 transition-colors group ${
                                        isBreaking ? 'bg-red-950/20' : isHigh ? 'bg-amber-950/10' : ''
                                    }`}
                                >
                                    {/* TIME */}
                                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-[11px]">
                                        {item.time || '--:--'}
                                    </td>

                                    {/* SOURCE */}
                                    <td className="py-2 px-3 whitespace-nowrap font-bold">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                item.source === 'Bloomberg' ? 'bg-blue-900/60 text-blue-300 border border-blue-700/50' :
                                                item.source === 'Reuters' ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50' :
                                                item.source === 'Nikkei' ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50' :
                                                item.source === 'MinkabuFX' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50' :
                                                item.source === 'Crypto' ? 'bg-orange-900/60 text-orange-300 border border-orange-700/50' :
                                                'bg-red-900/60 text-red-300 border border-red-700/50'
                                            }`}
                                        >
                                            {item.source}
                                        </span>
                                    </td>

                                    {/* CAT */}
                                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap text-[11px]">
                                        {catConfig.icon} {catConfig.labelEn}
                                    </td>

                                    {/* HEADLINE */}
                                    <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                            {isBreaking && (
                                                <span className="px-1.5 py-0.2 bg-red-600 text-white font-bold text-[9px] rounded animate-pulse">
                                                    BREAKING
                                                </span>
                                            )}
                                            {isHigh && (
                                                <span className="px-1.5 py-0.2 bg-amber-600 text-white font-bold text-[9px] rounded">
                                                    HIGH
                                                </span>
                                            )}
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-gray-200 group-hover:text-[#00ff66] transition-colors font-sans text-xs line-clamp-1"
                                            >
                                                {item.title}
                                            </a>
                                        </div>
                                    </td>

                                    {/* MARKET IMPACT (Sparkline) */}
                                    <td className="py-2 px-3 whitespace-nowrap">
                                        {marketSymbol ? (
                                            <Sparkline data={marketSymbol} compact />
                                        ) : (
                                            <span className="text-gray-600 text-[10px]">—</span>
                                        )}
                                    </td>

                                    {/* ACTION */}
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                        {onBookmark && (
                                            <button
                                                onClick={() => onBookmark(item)}
                                                className="text-gray-400 hover:text-yellow-400 transition-colors text-sm px-1.5"
                                                title={isBm ? 'ブックマーク解除' : 'ブックマーク'}
                                            >
                                                {isBm ? '★' : '☆'}
                                            </button>
                                        )}
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-500 hover:text-[#00ff66] transition-colors text-xs ml-1"
                                        >
                                            ↗
                                        </a>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
