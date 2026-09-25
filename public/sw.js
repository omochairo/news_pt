const CACHE_NAME = 'vantage-point-v2';
const STATIC_ASSETS = [
    '/',
    '/favicon.ico',
    '/manifest.json'
];

// Service Worker のインストール時
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Service Worker のアクティベート時
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// リクエストのフェッチ
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // API リクエストはネットワークを優先
    if (event.request.url.includes('/api/')) {
        return;
    }

    // ページ本体 (HTML) はネットワーク優先・オフライン時だけキャッシュ。
    // キャッシュを先に返すと、デプロイ後も古い HTML が古い JS チャンクを参照し続けて
    // 更新が反映されない・チャンク読み込みに失敗する。
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
                }
                return networkResponse;
            }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
        );
        return;
    }

    // それ以外の静的アセットは Stale-while-revalidate

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const cacheCopy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cacheCopy));
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
