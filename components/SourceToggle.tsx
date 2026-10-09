'use client';

import React from 'react';
import { NewsSource } from '@/lib/parser';
import { SOURCES, SOURCE_BY_NAME } from '@/lib/sources';

export const SOURCE_CONFIGS = SOURCE_BY_NAME;

export const ALL_SOURCES: NewsSource[] = SOURCES.map(s => s.source);

interface SourceToggleProps {
    activeSources: Set<NewsSource>;
    onToggle: (source: NewsSource) => void;
}

export default function SourceToggle({ activeSources, onToggle }: SourceToggleProps) {
    return (
        <div className="source-toggle-wrapper">
            <div className="source-toggle flex-nowrap md:flex-wrap">
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
                                boxShadow: `0 0 10px color-mix(in srgb, ${config.color} 20%, transparent)`,
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
