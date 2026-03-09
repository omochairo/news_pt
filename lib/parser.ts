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

export async function fetchBloombergNews(): Promise<NewsItem[]> {
    try {
        const response = await axios.get('https://www.bloomberg.co.jp/', {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
            }
        });

        const $ = cheerio.load(response.data);
        const news: NewsItem[] = [];

        // Bloombergのリンクからニュース記事を抽出
        $('a').each((_, element) => {
            const el = $(element);
            const url = el.attr('href');
            let title = el.text().trim().replace(/\s+/g, ' ');

            // BloombergのDOM構造対策: aタグ内にカテゴリspanと実際のタイトルが混在している場合、特有のクラスから正確なタイトルを抽出
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

            // ニュース記事URLかどうか判定
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

            // 時刻の取得
            let time = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const timeEl = el.closest('article').find('time, [class*="time"], [class*="date"]');
            if (timeEl.length > 0) {
                const extractedTime = timeEl.text().trim();
                if (extractedTime && extractedTime.length < 20) time = extractedTime;
            }

            if (!news.some(n => n.url === fullUrl)) {
                news.push({
                    title,
                    url: fullUrl,
                    source: 'Bloomberg',
                    time
                });
            }
        });

        return news.slice(0, 30);
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            console.error('Error fetching Bloomberg news:', error.message, error.response?.status);
        } else {
            console.error('Error fetching Bloomberg news:', error);
        }
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
