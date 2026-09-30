'use client';

import { useEffect } from 'react';

/**
 * load をすぐ 1 回呼び、以後 intervalMs ごとに呼ぶ。
 * ブラウザのタブが裏にある間は止め、表に戻ったらすぐ取り直す（見ていない間に外部 API を叩かない）
 */
export function usePolling(load: () => void, intervalMs: number, enabled = true) {
    useEffect(() => {
        if (!enabled) return;
        let timer: ReturnType<typeof setInterval> | undefined;
        const start = () => {
            if (timer) return;
            load();
            timer = setInterval(load, intervalMs);
        };
        const stop = () => {
            if (timer) clearInterval(timer);
            timer = undefined;
        };
        const onVisibility = () => (document.hidden ? stop() : start());

        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [load, intervalMs, enabled]);
}
