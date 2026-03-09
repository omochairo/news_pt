import React from 'react';
import { NewsItem } from '@/lib/parser';
import NewsCard from './NewsCard';

interface FeedSectionProps {
    title: string;
    items: NewsItem[];
    source: 'Bloomberg' | 'Reuters';
    loading?: boolean;
}

export default function FeedSection({ title, items, source, loading }: FeedSectionProps) {
    const accentColor = source === 'Bloomberg' ? 'var(--accent-bloomberg)' : 'var(--accent-reuters)';

    // Group items by date (mocking date groups as "Today" since parsing is flaky, but structure supports future expansion)
    // In a real scenario, we would parse item.time if it had a full date. 
    // For now, we assume most fetched news is recent.
    const groupedItems = {
        'Latest News': items
    };

    return (
        <section className="flex flex-col gap-6">
            <header className="flex items-center justify-between pb-4 border-b border-[var(--card-border)]">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                    <span
                        className="w-2 h-8 rounded-full"
                        style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
                    />
                    {title}
                </h2>
                <span className="text-xs font-mono px-2 py-1 rounded bg-[var(--card-bg)] border border-[var(--card-border)] text-[var(--text-secondary)]">
                    {loading ? 'SYNCING' : `${items.length} ITEMS`}
                </span>
            </header>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="glass-panel h-32 loading-pulse" />
                    ))}
                </div>
            ) : items.length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedItems).map(([group, groupItems]) => (
                        <div key={group}>
                            {/* <h3 className="text-sm text-[var(--text-secondary)] uppercase tracking-widest mb-3 pl-1">{group}</h3> */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {groupItems.map((item, index) => (
                                    <NewsCard key={`${item.url}-${index}`} item={item} index={index} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-12 text-center text-[var(--text-secondary)] glass-panel border-dashed">
                    <p className="text-lg">No matching news found.</p>
                    <p className="text-sm mt-2 opacity-60">Try adjusting your search query.</p>
                </div>
            )}
        </section>
    );
}
