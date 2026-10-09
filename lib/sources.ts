/**
 * ニュースの媒体の定義。媒体を足すときはここと lib/parser.ts の取得関数、lib/news-cache.ts の対応表を足す。
 * key は /api/news のレスポンスのキー、source は NewsItem.source の値
 */
export const SOURCES = [
    { source: 'Nikkei', key: 'nikkei', label: '日経新聞', icon: '📰', color: 'var(--accent-nikkei)', badge: 'bg-indigo-900/60 text-indigo-300 border border-indigo-700/50' },
    { source: 'MinkabuFX', key: 'minkabu', label: 'みんかぶFX', icon: '💱', color: 'var(--accent-minkabu)', badge: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700/50' },
    { source: 'Crypto', key: 'crypto', label: '暗号資産', icon: '₿', color: 'var(--accent-crypto)', badge: 'bg-orange-900/60 text-orange-300 border border-orange-700/50' },
    { source: 'Bloomberg', key: 'bloomberg', label: 'Bloomberg', icon: '📊', color: 'var(--accent-bloomberg)', badge: 'bg-blue-900/60 text-blue-300 border border-blue-700/50' },
    { source: 'Reuters', key: 'reuters', label: 'Reuters', icon: '🌐', color: 'var(--accent-reuters)', badge: 'bg-amber-900/60 text-amber-300 border border-amber-700/50' },
    { source: 'CNN', key: 'cnn', label: 'CNN Japan', icon: '📺', color: 'var(--accent-cnn)', badge: 'bg-red-900/60 text-red-300 border border-red-700/50' },
    { source: 'BOJ', key: 'boj', label: '日本銀行', icon: '🏦', color: 'var(--accent-boj)', badge: 'bg-rose-900/60 text-rose-300 border border-rose-700/50' },
    { source: 'Kabutan', key: 'kabutan', label: '株探', icon: '📈', color: 'var(--accent-kabutan)', badge: 'bg-green-900/60 text-green-300 border border-green-700/50' },
    { source: 'TradersWeb', key: 'traders', label: 'トレーダーズ・ウェブ', icon: '🧾', color: 'var(--accent-traders)', badge: 'bg-teal-900/60 text-teal-300 border border-teal-700/50' },
    { source: 'ZaiFX', key: 'zai', label: 'ザイFX！', icon: '💴', color: 'var(--accent-zai)', badge: 'bg-lime-900/60 text-lime-300 border border-lime-700/50' },
    { source: 'ToyoKeizai', key: 'toyokeizai', label: '東洋経済', icon: '📘', color: 'var(--accent-toyokeizai)', badge: 'bg-sky-900/60 text-sky-300 border border-sky-700/50' },
    { source: 'Diamond', key: 'diamond', label: 'ダイヤモンド', icon: '💎', color: 'var(--accent-diamond)', badge: 'bg-violet-900/60 text-violet-300 border border-violet-700/50' },
] as const;

export type SourceDef = (typeof SOURCES)[number];
export type NewsSource = SourceDef['source'];
export type NewsKey = SourceDef['key'];

/**
 * /api/health の 0 件チェックから外す媒体。東洋経済はカテゴリで絞ると新着 20 件中数件しか残らず、
 * 生活・キャリアの記事が続いた時間帯は正常でも 0 件になる
 */
export const UNMONITORED_SOURCES: ReadonlySet<NewsKey> = new Set<NewsKey>(['toyokeizai']);

export const SOURCE_BY_NAME =Object.fromEntries(SOURCES.map(s => [s.source, s])) as Record<NewsSource, SourceDef>;
