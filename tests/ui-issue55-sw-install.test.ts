import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

/** public/sw.js を最小の SW 環境で実行し、登録されたリスナーを返す */
function loadSw(addAll: () => Promise<void>) {
    const listeners: Record<string, (e: unknown) => void> = {};
    const self = {
        addEventListener: (type: string, fn: (e: unknown) => void) => { listeners[type] = fn; },
        skipWaiting: vi.fn(),
        clients: { claim: vi.fn() },
        location: { origin: 'http://localhost' },
    };
    const caches = { open: async () => ({ addAll }), keys: async () => [] };
    const code = readFileSync(join(__dirname, '../public/sw.js'), 'utf8');
    vm.runInNewContext(code, { self, caches, console: { warn: vi.fn(), error: vi.fn() }, URL, fetch: vi.fn() });
    return { listeners, self };
}

describe('sw.js: install', () => {
    it('事前キャッシュが失敗しても install は失敗しない（SW が入らなくならない）', async () => {
        const { listeners, self } = loadSw(() => Promise.reject(new Error('503')));
        let waited: Promise<unknown> = Promise.resolve();
        listeners.install({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
        await expect(waited).resolves.toBeUndefined();
        expect(self.skipWaiting).toHaveBeenCalled();
    });

    it('事前キャッシュが成功しても従来どおり', async () => {
        const addAll = vi.fn().mockResolvedValue(undefined);
        const { listeners } = loadSw(addAll);
        let waited: Promise<unknown> = Promise.resolve();
        listeners.install({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
        await waited;
        expect(addAll).toHaveBeenCalledWith(['/', '/favicon.ico', '/manifest.json']);
    });
});
