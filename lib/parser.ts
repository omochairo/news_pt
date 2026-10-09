import axios from 'axios';
import * as cheerio from 'cheerio';

import type { NewsSource } from './sources';

export type { NewsSource };

export interface NewsItem {
    title: string;
    url: string;
    source: NewsSource;
    time: string;       // 表示用 (例: "14:25" または "07/22 14:25")
    isoDate?: string;   // ソート用 ISO 8601 文字列
    paywall?: boolean;  // 記事ページで有料と確かめた（見出しから判定できない媒体用。lib/paywall.ts が使う）
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

/**
 * 日付オブジェクトから日本時間の表示用文字列とISO文字列を返す。
 * 日付が無い・読めない記事は取得時刻で埋めない（古い記事が「最新」として先頭に出るため）。
 * その場合 isoDate は undefined で、並べ替えでは末尾に回る。
 */
export function parseDateInfo(pubDateStr?: string, now: Date = new Date()): { time: string; isoDate?: string } {
    const dateObj = pubDateStr ? new Date(pubDateStr) : null;
    if (!dateObj || isNaN(dateObj.getTime())) {
        return { time: '' };
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
export function parseRssXml(
    xmlData: string,
    defaultSource: NewsSource,
    titleCleaner?: (t: string) => string,
    /** 指定すると、<category> がこのどれかに当たる記事だけを残す */
    categories?: string[],
): NewsItem[] {
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const news: NewsItem[] = [];

    const items = $('item, entry');

    items.each((_, el) => {
        const item = $(el);
        if (categories && !item.find('category').toArray().some(c => categories.includes($(c).text().trim()))) return;
        // 改行入りの見出し（東洋経済など）を 1 行にする
        let title = item.find('title').text().trim().replace(/\s*\n\s*/g, ' ');
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
async function fetchFromGoogleNewsRss(query: string, source: NewsSource, cleanSuffix?: string, extraCleaner?: (t: string) => string): Promise<NewsItem[]> {
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
            cleaned = cleaned.replace(/\s*[|｜]\s*(ロイター|Reuters|ブルームバーグ|Bloomberg|CNN\.co\.jp|日本経済新聞)\s*$/i, '').trim();
            return extraCleaner ? extraCleaner(cleaned).trim() : cleaned;
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
async function fetchRssUrls(
    urls: string[],
    source: NewsSource,
    label: string,
    titleCleaner?: (t: string) => string,
    categories?: string[],
): Promise<NewsItem[]> {
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
        for (const item of parseRssXml(result.value.data, source, titleCleaner, categories)) {
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

// 日銀の新着情報のうち、市場に関係しない事務連絡（採用・説明会・なりすまし注意など）
const BOJ_NOISE = /募集|説明会|座談会|採用|不審|ご注意|職員/;

/**
 * 日本銀行 新着情報 (公式 RSS)。金融政策・統計・総裁の講演など一次情報
 */
export async function fetchBOJNews(): Promise<NewsItem[]> {
    const items = await fetchRssUrls(['https://www.boj.or.jp/rss/whatsnew.xml'], 'BOJ', 'BOJ RSS');
    return items.filter(item => !BOJ_NOISE.test(item.title)).slice(0, 30);
}

/**
 * 株探 (Google News RSS 経由)。個別株の材料・決算・ストップ高安
 */
export async function fetchKabutanNews(): Promise<NewsItem[]> {
    const items = await fetchFromGoogleNewsRss('site:kabutan.jp when:2d', 'Kabutan', '株探');
    return items.slice(0, 30);
}

/**
 * トレーダーズ・ウェブ (Google News RSS 経由)。前場・後場コメント、今日の株価材料
 */
export async function fetchTradersWebNews(): Promise<NewsItem[]> {
    // 見出しの末尾に「 | 個別記事 | ニュース」のような分類が付く
    const items = await fetchFromGoogleNewsRss('site:traders.co.jp when:3d', 'TradersWeb', 'トレーダーズ・ウェブ',
        t => t.replace(/(\s*[|｜]\s*[^|｜]{1,12})+$/, ''));
    return items.slice(0, 30);
}

/**
 * ザイFX！ (Google News RSS 経由)。為替の市況速報
 */
export async function fetchZaiFXNews(): Promise<NewsItem[]> {
    // 見出しの末尾に「｜FX・為替ニュース」が付く
    const items = await fetchFromGoogleNewsRss('site:zai.diamond.jp when:3d', 'ZaiFX', 'ザイFX',
        t => t.replace(/\s*[|｜]\s*FX・為替ニュース$/, ''));
    return items.slice(0, 30);
}

/**
 * 東洋経済オンライン (公式 RSS)。半分以上が生活・キャリアの記事なので、配信のカテゴリで経済・ビジネスに絞る
 */
export async function fetchToyoKeizaiNews(): Promise<NewsItem[]> {
    // 見出しの末尾に「 | 政治・経済・投資 | 東洋経済オンライン」が付く
    const items = await fetchRssUrls(['https://toyokeizai.net/list/feed/rss'], 'ToyoKeizai', 'ToyoKeizai RSS',
        t => t.replace(/\s*[|｜][^|｜]*[|｜]\s*東洋経済オンライン\s*$/, ''),
        ['政治・経済・投資', 'ビジネス']);
    // RSS にも見出しにも有料の印が無いので、記事ページの構造化データで確かめる
    return enrichFromPage(items.slice(0, 30), html => ({ paid: isNotFreeByJsonLd(html) }));
}

/** 構造化データ（JSON-LD）の isAccessibleForFree が false なら有料。東洋経済の有料記事のページにだけ入っている */
export function isNotFreeByJsonLd(html: string): boolean {
    return /"isAccessibleForFree"\s*:\s*"?false/i.test(html);
}

interface PageInfo {
    paid: boolean;
    published?: string;
}

// 記事 URL ごとに記事ページから読んだ情報。有料・無料も配信日時も後から変わらないので、一度確かめたら取りに行かない
const pageInfoByUrl = new Map<string, PageInfo>();
const PAGE_INFO_CACHE_MAX = 2000;

/**
 * 記事ページを取り、inspect の結果で paywall と（無ければ）配信日時を補う。
 * 取れなかった記事はそのまま出し（有料の印なし）、次回の取得で確かめ直す
 */
async function enrichFromPage(items: NewsItem[], inspect: (html: string) => PageInfo): Promise<NewsItem[]> {
    const unknown = items.filter(item => !pageInfoByUrl.has(item.url));
    const results = await Promise.allSettled(unknown.map(item => axios.get(item.url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 8000,
        responseType: 'text',
    })));
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            pageInfoByUrl.set(unknown[i].url, inspect(String(result.value.data)));
        } else {
            const error = result.reason;
            console.error(`article page fetch failed for ${unknown[i].url}:`, error instanceof Error ? error.message : error);
        }
    });
    // 古いものから捨てる（Map は挿入順）
    while (pageInfoByUrl.size > PAGE_INFO_CACHE_MAX) pageInfoByUrl.delete(pageInfoByUrl.keys().next().value as string);

    return items.map(item => {
        const info = pageInfoByUrl.get(item.url);
        if (!info) return item;
        let next = item;
        if (info.paid) next = { ...next, paywall: true };
        if (!next.isoDate && info.published) next = { ...next, ...parseDateInfo(info.published) };
        return next;
    });
}

// 市況に近いテーマの一覧ページ。一覧には直リンクと有料の鍵マークが出る（日時は出ない）
const DIAMOND_THEMES = ['銀行・証券・金融', '予測・分析', 'マネー・投資'];
// テーマの一覧には数週間前の記事も残っているので、これより古い記事は出さない
const DIAMOND_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** ダイヤモンドの記事ページ: 有料会員限定なら記事種別の meta が GOLD（無料は NORMAL）。配信日時は JSON-LD の datePublished */
export function inspectDiamondPage(html: string): PageInfo {
    return {
        paid: /dia-articletype"\s+content="GOLD"/.test(html),
        published: html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1],
    };
}

/** ダイヤモンドのテーマ一覧ページから記事を拾う。見出しに after-icon-gold が付いていれば有料会員限定 */
export function parseDiamondList(html: string): NewsItem[] {
    const $ = cheerio.load(html);
    const items: NewsItem[] = [];
    $('a.u-text-link[href^="/articles/-/"]').each((_, el) => {
        const a = $(el);
        const url = `https://diamond.jp${a.attr('href')}`;
        const title = a.text().trim().replace(/\s+/g, ' ');
        if (isNoisyTitle(title) || items.some(n => n.url === url)) return;
        const paid = a.find('.after-icon-gold').length > 0;
        items.push({ title, url, source: 'Diamond', time: '', ...(paid ? { paywall: true } : {}) });
    });
    return items;
}

/**
 * ダイヤモンド・オンライン。公式 RSS は自己啓発の連載が大半なので、市況に近いテーマの一覧ページから拾い、
 * 記事ページで配信日時と有料かどうかを確かめる。一覧が取れないときは Google News（有料の判定なし）に切り替える
 */
export async function fetchDiamondNews(now: Date = new Date()): Promise<NewsItem[]> {
    const results = await Promise.allSettled(DIAMOND_THEMES.map(theme =>
        axios.get(`https://diamond.jp/list/theme/${encodeURIComponent(theme)}`, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: 8000,
            responseType: 'text',
        })));
    const listed: NewsItem[] = [];
    results.forEach((result, i) => {
        if (result.status === 'rejected') {
            const error = result.reason;
            console.error(`Diamond list fetch failed for ${DIAMOND_THEMES[i]}:`, error instanceof Error ? error.message : error);
            return;
        }
        for (const item of parseDiamondList(String(result.value.data))) {
            if (!listed.some(n => n.url === item.url)) listed.push(item);
        }
    });

    if (listed.length > 0) {
        const items = await enrichFromPage(listed.slice(0, 30), inspectDiamondPage);
        return items.filter(item => !item.isoDate || now.getTime() - new Date(item.isoDate).getTime() <= DIAMOND_MAX_AGE_MS);
    }

    const items = await fetchFromGoogleNewsRss(
        'site:diamond.jp -site:zai.diamond.jp (株価 OR 株式 OR 金利 OR 円安 OR 円高 OR 決算 OR 日銀 OR 景気 OR 物価 OR 為替 OR 投資) when:3d',
        'Diamond', 'ダイヤモンド・オンライン');
    return items.slice(0, 30);
}
