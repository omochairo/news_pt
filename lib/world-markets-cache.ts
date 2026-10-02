import axios from 'axios';
import { MARKETS, Quote24h, WorldQuote, parse24h, parseSparkResponse } from './world-markets';
import { QuotesSnapshot, createQuoteCache, fetchInBatches } from './quote-cache';

/**
 * /api/world-markets と /api/market（ニュース画面のティッカー）が共有する取得とキャッシュ。
 * 同じ銘柄を別々に Yahoo へ取りに行かず、両画面の値も揃える
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// spark API は 1 リクエスト 20 銘柄まで
const BATCH_SIZE = 20;

export type WorldQuotesSnapshot = QuotesSnapshot<WorldQuote>;

const worldCache = createQuoteCache<WorldQuote>(
    () => fetchInBatches(MARKETS.map(m => m.symbol), BATCH_SIZE, async symbols => {
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(',')}&range=1d&interval=5m`;
        const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 5000 });
        return parseSparkResponse(res.data);
    }, 'World markets'),
    'World markets',
);

// 週末をまたいでも直近 24 時間の取引が入るよう 5 日分を 15 分足で取る
const quotes24hCache = createQuoteCache<Quote24h>(
    () => fetchInBatches(MARKETS.filter(m => m.h24).map(m => m.symbol), BATCH_SIZE, async symbols => {
        const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(',')}&range=5d&interval=15m`;
        const res = await axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 6000 });
        return parse24h(res.data);
    }, '24h markets'),
    '24h markets',
);

export const getWorldQuotes = worldCache.get;
export const getWorldLastFetch = worldCache.getLastFetch;
export const getQuotes24h = quotes24hCache.get;
export const get24hLastFetch = quotes24hCache.getLastFetch;
