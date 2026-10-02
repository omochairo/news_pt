import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

vi.mock('next/font/google', () => ({
    Inter: () => ({ className: 'inter' }),
    JetBrains_Mono: () => ({ variable: '--font-mono' }),
}));

import RootLayout, { metadata, viewport } from '../app/layout';
import MarketsPage, { metadata as marketsMetadata } from '../app/markets/page';
import WorldMarketsBoard from '../components/WorldMarketsBoard';
import { MoveAlertsWatcher } from '../components/MoveAlerts';

describe('レイアウトとページ', () => {
    it('ルートレイアウトは子要素と変動通知の監視を置き、PWA のメタ情報を持つ', () => {
        const html = RootLayout({ children: 'child' }) as ReactElement<{ lang: string; children: ReactElement<{ className: string; children: ReactElement[] }> }>;
        expect(html.props.lang).toBe('ja');
        const body = html.props.children;
        expect(body.props.className).toContain('inter');
        expect(body.props.className).toContain('--font-mono');
        const [main, watcher] = body.props.children;
        expect((main as ReactElement<{ children: string }>).props.children).toBe('child');
        expect(watcher.type).toBe(MoveAlertsWatcher);
        expect(metadata.manifest).toBe('/manifest.json');
        expect(viewport.themeColor).toBe('#0a0e14');
    });

    it('/markets は世界の市場ボードを出す', () => {
        expect((MarketsPage() as ReactElement).type).toBe(WorldMarketsBoard);
        expect(marketsMetadata.title).toBe('世界の市場 | Vantage Point');
    });
});
