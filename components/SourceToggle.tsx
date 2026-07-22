'use client';

import React from 'react';
import { NewsSource } from '@/lib/parser';

export const SOURCE_CONFIGS: Record<NewsSource, { label: string; color: string; icon: string }> = {
    Nikkei: { label: '日経新聞', color: 'var(--accent-nikkei)', icon: '📰' },
    MinkabuFX: { label: 'みんかぶFX', color: 'var(--accent-minkabu)', icon: '💱' },
    Bloomberg: { label: 'Bloomberg', color: 'var(--accent-bloomberg)', icon: '📊' },
    Reuters: { label: 'Reuters', color: 'var(--accent-reuters)', icon: '🌐' },
    CNN: { label: 'CNN Japan', color: 'var(--accent-cnn)', icon: '📺' },
};

export const ALL_SOURCES: NewsSource[] = ['Nikkei', 'MinkabuFX', 'Bloomberg', 'Reuters', 'CNN'];

interface SourceToggleProps {
    activeSources: Set<NewsSource>;
    onToggle: (source: NewsSource) => void;
}

export default function SourceToggle({ activeSources, onToggle }: SourceToggleProps) {
    return (
        <div className="source-toggle-wrapper">
            <div className="source-toggle">
                {ALL_SOURCES.map((source) => {
                    const config = SOURCE_CONFIGS[source];
                    const isActive = activeSources.has(source);

                    return (
                        <button
                            key={source}
                            onClick={() => onToggle(source)}
                            className={`source-toggle-btn ${isActive ? 'source-toggle-active' : ''}`}
                            style={isActive ? {
                                borderColor: config.color,
                                boxShadow: `0 0 10px ${config.color}33`,
                            } : {}}
                        >
                            <span
                                className="source-toggle-dot"
                                style={{ backgroundColor: isActive ? config.color : 'var(--text-secondary)' }}
                            />
                            <span className="source-toggle-label">{config.icon} {config.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
