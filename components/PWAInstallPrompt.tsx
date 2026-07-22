'use client';

import React, { useEffect, useState } from 'react';

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);

    useEffect(() => {
        // Service Worker の登録
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch((err) => {
                console.error('Service Worker registration failed:', err);
            });
        }

        // PWA インストールプロンプトのキャッチ
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsInstallable(false);
        }
        setDeferredPrompt(null);
    };

    if (!isInstallable) return null;

    return (
        <button
            onClick={handleInstallClick}
            className="header-action-btn bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 font-semibold flex items-center gap-1 text-xs px-2.5"
            title="アプリをホーム画面にインストール"
        >
            <span>📱</span>
            <span className="hidden sm:inline">アプリインストール</span>
        </button>
    );
}
