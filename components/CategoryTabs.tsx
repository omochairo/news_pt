'use client';

import React from 'react';
import { NewsCategory, CATEGORIES } from '@/lib/categorizer';

interface CategoryTabsProps {
    activeCategory: NewsCategory;
    onCategoryChange: (category: NewsCategory) => void;
    /** 各カテゴリのアイテム数 */
    counts?: Record<NewsCategory, number>;
}

export default function CategoryTabs({ activeCategory, onCategoryChange, counts }: CategoryTabsProps) {
    return (
        <div className="category-tabs-wrapper">
            <div className="category-tabs">
                {CATEGORIES.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    const count = counts?.[cat.id] ?? 0;

                    return (
                        <button
                            key={cat.id}
                            onClick={() => onCategoryChange(cat.id)}
                            className={`category-tab ${isActive ? 'category-tab-active' : ''}`}
                            title={cat.label}
                        >
                            <span className="category-tab-icon">{cat.icon}</span>
                            <span className="category-tab-label">{cat.label}</span>
                            {cat.id !== 'all' && count > 0 && (
                                <span className="category-tab-count">{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
