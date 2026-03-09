import axios from 'axios';
import * as cheerio from 'cheerio';

export type NewsSource = 'Bloomberg' | 'Reuters' | 'CNN';

export interface NewsItem {
    title: string;
    url: string;
    source: NewsSource;
    time?: string;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * ノイズ除去: ナビゲーション、画像クレジット、UIテキストなどを除外する
 */
const NOISE_PATTERNS = [
    /を閲覧する/,
    /を見る$/,
    /に移動$/,
    /^メニュー/,
    /^ログイン/,
    /^サインイン/,
    /^登録/,
    /^購読/,
    /^Subscribe/i,
    /^Sign [Ii]n/,
    /^Log [Ii]n/,
    /^Read More/i,
    /^もっと見る/,
    /^advertisement/i,
    /^広告/,
    /Getty Images/i,
    /NurPhoto/i,
    /AFP\/?Getty/i,
    /Source images?:/i,
    /Interview Magazine/i,
    /Photographer:/i,
    /Bloomberg$/,
    /Reuters$/,
    /^Photo:/i,
    /^\(.*\)$/,
    /^関連記事/,
    /^おすすめ/,
    /^人気記事/,
    /^ランキング/,
    /^Copyright/i,
    /^©/,
    /^\[.*\]$/,
    /閲覧する$/,
    /^すべて.*を見る/,
    /^View all/i,
    /^Show more/i,
    /category$/i,
];

function isNoisyTitle(title: string): boolean {
    if (title.length < 12) return true;
    // スラッシュが多い（パスのような文字列 or 画像クレジット）
    if ((title.match(/\//g) || []).length > 2) return true;
    // 全て英数字と記号だけで構成されたクレジット行（日本語が含まれないもの）
    if (/^[A-Za-z0-9\s\/'".,:;!\-()]+$/.test(title) && title.length < 60) return true;
    // ノイズパターンに一致
    return NOISE_PATTERNS.some(pattern => pattern.test(title));
}

/**
 * Bloomberg Japan の記事を取得する
 * 1. まず bloomberg.co.jp に直接アクセスを試みる
 * 2. 403等でブロックされた場合は Google News RSS 経由でフォールバック
 */
export async function fetchBloombergNews(): Promise<NewsItem[]> {
    // 1. 直接スクレイピングを試行
    const directResult = await fetchBloombergDirect();
    if (directResult.length > 0) {
        return directResult;
    }

    // 2. フォールバック: Google News RSS 経由
    console.log('Bloomberg direct access failed, falling back to Google News RSS...');
    return fetchBloombergViaGoogleNews();
}

async function fetchBloombergDirect(): Promise<NewsItem[]> {
    try {
        const response = await axios.get('https://www.bloomberg.co.jp/', {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
            },
            timeout: 8000,
        });

        const $ = cheerio.load(response.data);
        const news: NewsItem[] = [];

        $('a').each((_, element) => {
            const el = $(element);
            const url = el.attr('href');
            let title = el.text().trim().replace(/\s+/g, ' ');

            const specificTitleEl = el.find('h3, [class*="headline"], [class*="title"]').first();
            if (specificTitleEl.length > 0) {
                const specificTitle = specificTitleEl.text().trim().replace(/\s+/g, ' ');
                if (specificTitle && specificTitle.length > 5) {
                    title = specificTitle;
                }
            }

            if (!url || !title || title.length < 10) return;
            if (isNoisyTitle(title)) return;
            if (url.includes('javascript') || url.includes('void')) return;

            const isNews =
                url.includes('/news/articles/') ||
                url.includes('/articles/') ||
                el.closest('article').length > 0 ||
                el.closest('[class*="story"]').length > 0 ||
                el.closest('[class*="Story"]').length > 0 ||
                el.closest('[class*="headline"]').length > 0;

            if (!isNews) return;

            let fullUrl = url;
            if (!url.startsWith('http')) {
                if (url.startsWith('/jp/')) {
                    fullUrl = `https://www.bloomberg.com${url}`;
                } else {
                    fullUrl = `https://www.bloomberg.co.jp${url}`;
                }
            }

            let time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const timeEl = el.closest('article').find('time, [class*="time"], [class*="date"]');
            if (timeEl.length > 0) {
                const extractedTime = timeEl.text().trim();
                if (extractedTime && extractedTime.length < 20) time = extractedTime;
            }

            if (!news.some(n => n.url === fullUrl)) {
                news.push({ title, url: fullUrl, source: 'Bloomberg', time });
            }
        });

        return news.slice(0, 30);
    } catch (error: any) {
        console.error('Bloomberg direct fetch failed:', error.message, error.response?.status || '');
        return [];
    }
}

/**
 * Google News RSS 経由で Bloomberg Japan の記事を取得（フォールバック用）
 */
async function fetchBloombergViaGoogleNews(): Promise<NewsItem[]> {
    try {
        // ニュース記事URLに限定した検索クエリ + 株価ページを除外
        const rssUrl = 'https://news.google.com/rss/search?q=site:bloomberg.co.jp/news/articles+-"Stock+Price+Quote"+-"Quote+-"&hl=ja&gl=JP&ceid=JP:ja';
        const response = await axios.get(rssUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const news: NewsItem[] = [];
        const now = new Date();

        // 株価・マーケットデータページを除外するパターン
        const MARKET_DATA_PATTERNS = [
            /Stock Price Quote/i,
            /\bQuote\s*[-–—]/i,
            /ETF Fund$/i,
            /Index Quote/i,
            /Bond Quote/i,
            /Futures Quote/i,
            /^\d{4}:/,           // "2408: 南亜科技..." のような銘柄コードで始まるもの
            /^[A-Z]{2,5}\s*Quote/i, // "FANG Quote" のようなティッカーで始まるもの
        ];

        $('item').each((_, element) => {
            const el = $(element);
            let title = el.find('title').text().trim();
            const link = el.find('link').text().trim();
            const pubDate = el.find('pubDate').text().trim();

            if (!title || !link) return;

            // Google News のタイトルから " - Bloomberg" サフィックスを除去
            title = title.replace(/\s*[-–—]\s*Bloomberg.*$/i, '').trim();

            if (title.length < 10) return;
            if (isNoisyTitle(title)) return;

            // 株価・マーケットデータページを除外
            if (MARKET_DATA_PATTERNS.some(p => p.test(title))) return;

            // 時刻を pubDate から取得
            let time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            if (pubDate) {
                try {
                    const d = new Date(pubDate);
                    time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                } catch { /* 現在時刻を使用 */ }
            }

            if (!news.some(n => n.title === title)) {
                news.push({
                    title,
                    url: link,
                    source: 'Bloomberg',
                    time,
                });
            }
        });

        console.log(`Bloomberg via Google News RSS: ${news.length} articles found`);
        return news.slice(0, 30);
    } catch (error: any) {
        console.error('Bloomberg Google News RSS fallback failed:', error.message);
        return [];
    }
}

export async function fetchReutersNews(): Promise<NewsItem[]> {
    try {
        const response = await axios.get('https://jp.reuters.com/', {
            headers: { 'User-Agent': USER_AGENT }
        });
        const $ = cheerio.load(response.data);
        const news: NewsItem[] = [];

        // ニュースリンクを抽出（data-testid を優先、なければ article 内のリンク）
        $('a[data-testid="Heading"], a[class*="Heading"], article a, [class*="story-card"] a').each((_, element) => {
            const el = $(element);
            const title = el.text().trim();
            let url = el.attr('href');

            if (!title || !url) return;
            if (isNoisyTitle(title)) return;

            if (!url.startsWith('http')) {
                url = `https://jp.reuters.com${url}`;
            }

            // カテゴリトップページ（/world/, /markets/ 等）を除外
            // 実際の記事URLはパスに記事スラッグが含まれる（例: /markets/japan/XXXX-YYYY/）
            try {
                const urlPath = new URL(url).pathname;
                const segments = urlPath.split('/').filter(s => s.length > 0);
                // カテゴリページは1セグメント（/world/）、記事は2+セグメント
                if (segments.length < 2) return;
            } catch {
                return;
            }

            if (!news.some(n => n.url === url) && title.length > 10) {
                // 時刻の取得
                let time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                const timeEl = el.closest('[class*="media-object"], article, div').find('time, [class*="time"], [data-testid="Label"]');
                if (timeEl.length > 0) {
                    const extractedTime = timeEl.first().text().trim();
                    // 時刻バリデーション: 数字を含み、かつ短い文字列のみ受け入れる
                    if (extractedTime && extractedTime.length < 15 && /\d/.test(extractedTime) && !/category/i.test(extractedTime)) {
                        time = extractedTime;
                    }
                }

                news.push({
                    title,
                    url,
                    source: 'Reuters',
                    time
                });
            }
        });

        return news.slice(0, 30);
    } catch (error) {
        console.error('Error fetching Reuters news:', error);
        return [];
    }
}

export async function fetchCNNNews(): Promise<NewsItem[]> {
    try {
        const response = await axios.get('https://www.cnn.co.jp/', {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            },
            timeout: 10000,
        });

        const $ = cheerio.load(response.data);
        const news: NewsItem[] = [];

        // CNN.co.jp の記事リンクを抽出
        $('a').each((_, element) => {
            const el = $(element);
            let url = el.attr('href');
            let title = el.text().trim();

            if (!url || !title) return;
            if (isNoisyTitle(title)) return;
            if (url.includes('javascript') || url.includes('void')) return;

            // CNN.co.jp の記事URL形式チェック
            const isArticle = url.includes('/article/') ||
                url.includes('/world/') ||
                url.includes('/business/') ||
                url.includes('/tech/') ||
                url.includes('/entertainment/') ||
                url.includes('/sport/');

            if (!isArticle) return;

            // カテゴリトップページを除外（パスセグメント2つ以上必要）
            if (!url.startsWith('http')) {
                url = `https://www.cnn.co.jp${url}`;
            }

            try {
                const urlPath = new URL(url).pathname;
                const segments = urlPath.split('/').filter(s => s.length > 0);
                if (segments.length < 2) return;
            } catch {
                return;
            }

            if (!news.some(n => n.url === url) && title.length > 10) {
                const time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                news.push({
                    title,
                    url,
                    source: 'CNN',
                    time,
                });
            }
        });

        return news.slice(0, 30);
    } catch (error) {
        console.error('Error fetching CNN news:', error);
        return [];
    }
}
