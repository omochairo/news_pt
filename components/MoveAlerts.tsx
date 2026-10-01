'use client';

import React, { useEffect, useState } from 'react';
import {
    ALERTS_CHANGE_EVENT,
    ALERTS_ENABLED_KEY,
    ALERT_SYMBOLS,
    ALERT_THRESHOLD,
    MoveAlert,
    evaluateAlerts,
    readAlertState,
    readAlertsEnabled,
    saveAlertState,
    saveAlertsEnabled,
} from '@/lib/move-alerts';
import { MARKETS, Quote24h, formatChange, formatPrice } from '@/lib/world-markets';

const CHECK_MS = 60 * 1000;
// 週末で止まっている先物などは、最後の足がこれより古ければ判定しない（止まった値で鳴らさない）
const STALE_MS = 60 * 60 * 1000;

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

function useAlertsActive(): boolean {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const sync = () => setActive(readAlertsEnabled() && notificationsSupported() && Notification.permission === 'granted');
        const onStorage = (e: StorageEvent) => { if (e.key === ALERTS_ENABLED_KEY) sync(); };
        sync();
        window.addEventListener(ALERTS_CHANGE_EVENT, sync);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(ALERTS_CHANGE_EVENT, sync);
            window.removeEventListener('storage', onStorage);
        };
    }, []);
    return active;
}

async function showMoveNotification(alert: MoveAlert, quote: Quote24h) {
    const def = MARKETS.find(m => m.symbol === alert.symbol);
    if (!def) return;
    const title = `${def.name} ${formatChange(alert.changePercent, 2)}%（24時間）`;
    const options: NotificationOptions = {
        body: `現在値 ${formatPrice(quote.price, def)}（24時間前 ${formatPrice(quote.base, def)}）`,
        // 同じ銘柄の通知は積み重ねず置き換える
        tag: `move-${alert.symbol}`,
        icon: '/favicon.ico',
        data: { url: '/markets' },
    };
    // スマホの Chrome はページから new Notification できないので、Service Worker があればそちらで出す
    const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
    if (registration) {
        await registration.showNotification(title, options);
        return;
    }
    const n = new Notification(title, options);
    n.onclick = () => {
        window.focus();
        n.close();
    };
}

/**
 * 通知をオンにしている間、24 時間の騰落率を 1 分ごとに見て、大きく動いたら知らせる。
 * 裏のタブでも止めない（それが目的）。値はサーバー側で 1 分キャッシュされているので、外部への問い合わせは増えない
 */
export function MoveAlertsWatcher() {
    const active = useAlertsActive();

    useEffect(() => {
        if (!active) return;
        let stopped = false;

        const check = async () => {
            try {
                const res = await fetch('/api/world-markets/24h');
                if (!res.ok || stopped) return;
                const body: { quotes: Quote24h[] } = await res.json();
                const now = Date.now();
                const fresh = body.quotes.filter(q => now - new Date(q.to).getTime() <= STALE_MS);
                // 判定の直前に読み直す（別のタブが先に通知していれば重ねない）
                const { alerts, next } = evaluateAlerts(fresh, readAlertState());
                saveAlertState(next);
                for (const alert of alerts) {
                    const quote = fresh.find(q => q.symbol === alert.symbol);
                    if (quote) await showMoveNotification(alert, quote);
                }
            } catch {
                // 次の回に任せる
            }
        };

        check();
        const timer = setInterval(check, CHECK_MS);
        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [active]);

    return null;
}

const ALERT_NAMES = ALERT_SYMBOLS.map(s => MARKETS.find(m => m.symbol === s)?.name ?? s).join('・');

/** /markets のヘッダーに置く切り替えボタン */
export function MoveAlertsToggle() {
    const [enabled, setEnabled] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

    // サーバー描画と食い違わないよう、マウント後に読む。別のタブで切り替えたときも追従する
    useEffect(() => {
        const sync = () => {
            setEnabled(readAlertsEnabled());
            setPermission(notificationsSupported() ? Notification.permission : 'unsupported');
        };
        const onStorage = (e: StorageEvent) => { if (e.key === ALERTS_ENABLED_KEY) sync(); };
        sync();
        window.addEventListener(ALERTS_CHANGE_EVENT, sync);
        window.addEventListener('storage', onStorage);
        return () => {
            window.removeEventListener(ALERTS_CHANGE_EVENT, sync);
            window.removeEventListener('storage', onStorage);
        };
    }, []);

    if (permission === 'unsupported') return null;

    const on = enabled && permission === 'granted';
    const toggle = async () => {
        if (on) {
            saveAlertsEnabled(false);
            setEnabled(false);
            return;
        }
        const result = permission === 'granted' ? 'granted' : await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            saveAlertsEnabled(true);
            setEnabled(true);
        }
    };

    const help = `${ALERT_NAMES}が 24 時間で ±${ALERT_THRESHOLD}% を超えたら通知します（このサイトを開いている間だけ）`;
    if (permission === 'denied') {
        return <span className="text-[10px] text-amber-400" title={help}>通知はブラウザの設定でブロックされています</span>;
    }
    return (
        <button
            type="button"
            onClick={toggle}
            aria-pressed={on}
            title={help}
            className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                on ? 'bg-blue-600 border-blue-500 text-white font-bold' : 'border-[var(--card-border)] text-gray-400 hover:text-gray-200'
            }`}
        >
            {on ? '変動通知 オン' : '変動通知 オフ'}
        </button>
    );
}
