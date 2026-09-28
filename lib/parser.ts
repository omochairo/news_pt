import axios from 'axios';
import * as cheerio from 'cheerio';

export type NewsSource = 'Bloomberg' | 'Reuters' | 'CNN' | 'Nikkei' | 'MinkabuFX' | 'Crypto';

export interface NewsItem {
    title: string;
    url: string;
    source: NewsSource;
    time: string;       // 表示用 (例: "14:25" または "07/22 14:25")
    isoDate?: string;   // ソート用 ISO 8601 文字列
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 株価・価格・為替レート・ETF・銘柄コード等のノイズパターン */
const NOISE_PATTERNS = [
    /Stock Price/i,
    /Exchange Rate/i,
    /Latest News \| Reuters/i,
    /Latest News \| Bloomberg/i,
    /\bQuote\b/i,
    /\bFund\b/i,
    /\bSubindex\b/i,
    /Futures/i,
    /YieldBOOST/i,
    /BuyWrite/i,
    /^\d{4}:/,
    /^[A-Za-z0-9._%()^/:\-\s]+$/,  // 全て英数字・記号のみ（日本語が含まれない銘柄コード等）
    /^PR TIMES/i,
    /^広告/,
    /^AD:/i,
];

function isNoisyTitle(title: string): boolean {
    if (!title || title.length < 6) return true;
    return NOISE_PATTERNS.some(pattern => pattern.test(title));
}

/** 日付オブジェクトから日本時間の表示用文字列とISO文字列を返す */
function parseDateInfo(pubDateStr?: string): { time: string; isoDate: string } {
    const now = new Date();
    let dateObj = now;

    if (pubDateStr) {
        try {
            const parsed = new Date(pubDateStr);
            if (!isNaN(parsed.getTime())) {
                dateObj = parsed;
            }
        } catch {
            dateObj = now;
        }
    }

    const isoDate = dateObj.toISOString();

    // 今日と同じ日付なら HH:MM、違えば MM/DD HH:MM。
    // サーバー (Netlify) は UTC で動くので、日付の判定も JST で行う（JST 0〜9時の記事が前日扱いになっていた）
    const jstDate = (d: Date) => d.toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', year: 'numeric',
    });
    const isToday = jstDate(dateObj) === jstDate(now);

    const timeStr = dateObj.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Tokyo',
    });

    if (isToday) {
        return { time: timeStr, isoDate };
    } else {
        const monthDay = dateObj.toLocaleDateString('ja-JP', {
            timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
        });
        return { time: `${monthDay} ${timeStr}`, isoDate };
    }
}

/** http(s) 以外のスキーム（javascript: など）のリンクを弾く */
export function isSafeHttpUrl(url: string): boolean {
    try {
        const { protocol } = new URL(url);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * RSS (RDF / RSS 2.0 / Atom) XML文字列から NewsItem[] をパースする共通ヘルパー
 */
export function parseRssXml(xmlData: string, defaultSource: NewsSource, titleCleaner?: (t: string) => string): NewsItem[] {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const news: NewsItem[] = [];

    const items = $('item, entry');

    items.each((_, el) => {
        const item = $(el);
        let title = item.find('title').text().trim();
        if (titleCleaner) {
            title = titleCleaner(title);
        }

        let url = item.find('link').text().trim();
        if (!url) {
            url = item.find('link').attr('href') || '';
        }

        const dateStr =
            item.find('dc\\:date').text().trim() ||
            item.find('pubDate').text().trim() ||
            item.find('published').text().trim() ||
            item.find('updated').text().trim();

        if (!title || !url || !isSafeHttpUrl(url) || isNoisyTitle(title)) return;

        const { time, isoDate } = parseDateInfo(dateStr);

        if (!news.some(n => n.url === url || n.title === title)) {
            news.push({
                title,
                url,
                source: defaultSource,
                time,
                isoDate,
            });
        }
    });

    return news;
}

/**
 * Google News RSS から指定されたクエリで記事を取得する共通関数
 */
async function fetchFromGoogleNewsRss(query: string, source: NewsSource, cleanSuffix?: string): Promise<NewsItem[]> {
    try {
        const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
        const response = await axios.get(rssUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 10000,
        });

        // Google News の見出しは末尾が必ず「 - 媒体名」。媒体名の表記揺れ（ロイター / Reuters 等）があるので
        // 指定の媒体名で落とせなかったときは最後の区切り以降を落とす
        return parseRssXml(response.data, source, (title) => {
            let cleaned = title;
            if (cleanSuffix) {
                cleaned = title.replace(new RegExp(`\\s*[-–—]\\s*${cleanSuffix}.*$`, 'i'), '');
            }
            if (cleaned === title) {
                cleaned = title.replace(/\s+[-–—]\s+[^-–—]+$/, '');
            }
            // 媒体側のタイトルに付いている「 | ロイター」等も落とす
            return cleaned.replace(/\s*[|｜]\s*(ロイター|Reuters|ブルームバーグ|Bloomberg|CNN\.co\.jp|日本経済新聞)\s*$/i, '').trim();
        });
    } catch (error) {
        console.error(`Google News RSS fetch failed for ${source} (${query}):`, error instanceof Error ? error.message : error);
        return [];
    }
}

/**
 * assets.wor.jp (RSS愛好会) の RDF から記事を取得する共通関数
 */
async function fetchFromWorRdf(rdfUrls: string[], source: NewsSource): Promise<NewsItem[]> {
    return fetchRssUrls(rdfUrls, source, 'WOR RDF');
}

/**
 * 複数の RSS URL を並列に取得し、URL の並び順を保ったまま重複を除いて結合する。
 * 直列だと 1 本 8 秒のタイムアウトが URL 数だけ積み上がり、関数の実行上限を超えうる。
 */
async function fetchRssUrls(urls: string[], source: NewsSource, label: string): Promise<NewsItem[]> {
    const results = await Promise.allSettled(
        urls.map(url => axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 8000,
        }))
    );

    const allItems: NewsItem[] = [];
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const error = result.reason;
            console.error(`${label} fetch failed for ${urls[i]}:`, error instanceof Error ? error.message : error);
            return;
        }
        for (const item of parseRssXml(result.value.data, source)) {
            if (!allItems.some(n => n.url === item.url || n.title === item.title)) {
                allItems.push(item);
            }
        }
    });

    return allItems;
}

/**
 * Bloomberg ニュース取得 (Google News RSS 経由)
 * 「ブルームバーグ」キーワードで記事（ニュース）のみを抽出
 */
export async function fetchBloombergNews(): Promise<NewsItem[]> {
    const items = await fetchFromGoogleNewsRss('ブルームバーグ when:2d', 'Bloomberg', 'Bloomberg.com');
    if (items.length > 0) return items.slice(0, 30);

    return fetchFromGoogleNewsRss('ブルームバーグ ニュース when:2d', 'Bloomberg', 'Bloomberg');
}

/**
 * Reuters ニュース取得 (Google News RSS 経由)
 * 「ロイター」キーワードで記事（ニュース）のみを抽出
 */
export async function fetchReutersNews(): Promise<NewsItem[]> {
    const items = await fetchFromGoogleNewsRss('ロイター when:2d', 'Reuters', 'ロイター');
    if (items.length > 0) return items.slice(0, 30);

    return fetchFromGoogleNewsRss('ロイター ニュース when:2d', 'Reuters', 'ロイター');
}

/**
 * CNN ニュース取得
 */
export async function fetchCNNNews(): Promise<NewsItem[]> {
    const items = await fetchFromGoogleNewsRss('site:cnn.co.jp when:2d', 'CNN', 'CNN.co.jp');
    if (items.length > 0) return items.slice(0, 30);

    return fetchFromGoogleNewsRss('CNN when:2d', 'CNN', 'CNN');
}

/**
 * 日経新聞 ニュース取得 (assets.wor.jp RSS)
 */
export async function fetchNikkeiNews(): Promise<NewsItem[]> {
    const rdfUrls = [
        'https://assets.wor.jp/rss/rdf/nikkei/markets.rdf',
        'https://assets.wor.jp/rss/rdf/nikkei/economy.rdf',
        'https://assets.wor.jp/rss/rdf/nikkei/news.rdf',
        'https://assets.wor.jp/rss/rdf/nikkei/business.rdf',
    ];
    const items = await fetchFromWorRdf(rdfUrls, 'Nikkei');

    if (items.length > 0) return items.slice(0, 35);

    return fetchFromGoogleNewsRss('site:nikkei.com when:1d', 'Nikkei', '日本経済新聞');
}

/**
 * みんかぶ FX ニュース取得 (assets.wor.jp RSS)
 */
export async function fetchMinkabuFXNews(): Promise<NewsItem[]> {
    const rdfUrls = [
        'https://assets.wor.jp/rss/rdf/minkabufx/statement.rdf',
        'https://assets.wor.jp/rss/rdf/minkabufx/stock.rdf',
        'https://assets.wor.jp/rss/rdf/minkabufx/commodity.rdf',
    ];
    const items = await fetchFromWorRdf(rdfUrls, 'MinkabuFX');

    if (items.length > 0) return items.slice(0, 30);

    return fetchFromGoogleNewsRss('みんかぶ FX when:1d', 'MinkabuFX');
}

/**
 * 暗号資産 (Crypto / Web3) ニュース取得 (CoinPost & CoinDesk Japan RSS)
 */
export async function fetchCryptoNews(): Promise<NewsItem[]> {
    const cryptoRssUrls = [
        'https://coinpost.jp/?feed=rss2',
        'https://www.coindeskjapan.com/feed/',
    ];

    const allItems = await fetchRssUrls(cryptoRssUrls, 'Crypto', 'Crypto RSS');

    if (allItems.length > 0) {
        return allItems.slice(0, 30);
    }

    // フォールバック: Google News RSS
    return fetchFromGoogleNewsRss('暗号資産 OR ビットコイン OR イーサリアム when:2d', 'Crypto');
}
