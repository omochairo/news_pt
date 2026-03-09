import React from 'react';
import { NewsItem } from '@/lib/parser';

interface NewsCardProps {
    item: NewsItem;
    index?: number;
}

export default function NewsCard({ item, index = 0 }: NewsCardProps) {
    const isBloomberg = item.source === 'Bloomberg';

    // Mock stats for display to match the reference image
    // Generating deterministic random numbers based on index
    const views = {
        today: (index * 3 + 12) % 50,
        week: (index * 7 + 45) % 200,
        month: (index * 13 + 120) % 500,
    };

    return (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-panel group relative flex flex-col p-6 h-full transition-all duration-300 hover:border-[var(--accent-bloomberg)]"
        >
            {/* Background Glow Effect on Hover */}
            <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${isBloomberg ? 'var(--accent-bloomberg)' : 'var(--accent-reuters)'}, transparent)` }}
            />

            {/* Header: Badge & Date */}
            <div className="flex items-center justify-between mb-4 relative z-10">
                <span 
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase tracking-wider"
                    style={{ 
                        backgroundColor: isBloomberg ? 'var(--accent-bloomberg)' : 'var(--accent-reuters)',
                        boxShadow: `0 0 10px ${isBloomberg ? 'var(--accent-bloomberg)' : 'var(--accent-reuters)}44`
                    }}
                >
                    {item.source}
                </span>
                <div className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {item.time || 'JUST NOW'}
                </div>
            </div>
 
            {/* Content Section */}
            <div className="flex flex-col flex-grow relative z-10">
                {/* Title */}
                <h3 className="text-lg font-semibold leading-snug mb-3 group-hover:text-white transition-colors line-clamp-2">
                    {item.title}
                </h3>
 
                {/* Description - Subtle fallback text */}
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-6 font-light leading-relaxed opacity-80">
                    Source: {item.source} Japan. Click to read the full market report and analysis on the official site.
                </p>
 
                {/* Footer - Stats & Action */}
                <div className="mt-auto pt-4 border-t border-[var(--card-border)] flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-widest">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                             <svg className="w-3 h-3 text-[var(--accent-bloomberg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {views.today}
                        </span>
                        <span>TRENDING</span>
                    </div>
                    <span className="text-white opacity-40 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        ENTER
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                         </svg>
                    </span>
                </div>
            </div>
        </a>
    );
}
