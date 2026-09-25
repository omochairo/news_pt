import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface MarketData {
    symbol: string;
    name: string;
    price: string;
    change: string;
    changePercent: string;
    direction: 'up' | 'down' | 'flat';
    history: number[]; // Sparkline 用のイントラデイ終値（古い順）
}

type Quote = { price: number; change: number; changePercent: number; history: number[] };

/**
 * Google Finance からスクレイピングで価格を取得する
 */
const GOOGLE_FINANCE_SYMBOLS = [
    { gfSymbol: 'USD-JPY', name: 'USD/JPY' },
    { gfSymbol: 'EUR-JPY', name: 'EUR/JPY' },
    { gfSymbol: 'GBP-JPY', name: 'GBP/JPY' },
    { gfSymbol: 'NI225:INDEXNIKKEI', name: '日経225' },
    { gfSymbol: '.INX:INDEXSP', name: 'S&P 500' },
    { gfSymbol: '.DJI:INDEXDJX', name: 'ダウ平均' },
    { gfSymbol: '.IXIC:INDEXNASDAQ', name: 'NASDAQ' },
    { gfSymbol: 'BTC-USD', name: 'BTC/USD' },
    { gfSymbol: 'CL=F', name: '原油WTI' },
];

async function fetchFromGoogleFinance(gfSymbol: string): Promise<Quote | null> {
    try {
        const url = `https://www.google.com/finance/quote/${gfSymbol}`;
        const resp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 8000,
        });

        const $ = cheerio.load(resp.data);

        // Google Finance の data-last-price 属性を探す
        const priceEl = $('[data-last-price]');
        if (priceEl.length > 0) {
            const price = parseFloat(priceEl.attr('data-last-price') || '0');
            const change = parseFloat(priceEl.attr('data-price-change') || '0');
            const changePercent = parseFloat(priceEl.attr('data-price-change-percent') || '0');
            if (price > 0) {
                return { price, change, changePercent, history: [] };
            }
        }

        // フォールバック: テキストから取得
        const priceText = $('[class*="YMlKec fxKbKc"]').first().text().replace(/[,¥$€£]/g, '');
        const price = parseFloat(priceText);
        if (price > 0) {
            return { price, change: 0, changePercent: 0, history: [] };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Yahoo Finance v8 chart API (メイン)
 * range=1d のイントラデイ足から Sparkline 用の履歴も取る。
 * 週末・休場で当日足が空のときは 5d の1時間足で直近の推移を補う。
 */
async function fetchYahooChart(symbol: string, range: string, interval: string) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 5000,
    });
    const result = response.data?.chart?.result?.[0];
    const closes: unknown[] = result?.indicators?.quote?.[0]?.close || [];
    const history = closes.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    return { meta: result?.meta, history };
}

const SPARKLINE_MAX_POINTS = 32;

function downsample(values: number[], max: number): number[] {
    if (values.length <= max) return values;
    const step = (values.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
}

async function fetchFromYahooChart(symbol: string): Promise<Quote | null> {
    try {
        const intraday = await fetchYahooChart(symbol, '1d', '15m');
        const meta = intraday.meta;
        let history = intraday.history;
        if (!meta) return null;

        if (history.length < 2) {
            const fallback = await fetchYahooChart(symbol, '5d', '1h').catch(() => null);
            if (fallback && fallback.history.length >= 2) history = fallback.history.slice(-24);
        }

        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;

        if (currentPrice != null && previousClose != null && previousClose !== 0) {
            const change = currentPrice - previousClose;
            const changePercent = (change / previousClose) * 100;
            // 最終点は現在値に揃える（足の確定待ちで末尾がずれるのを防ぐ）
            const points = downsample(history, SPARKLINE_MAX_POINTS).map(v => Number(v.toFixed(4)));
            if (points.length > 0) points[points.length - 1] = currentPrice;
            return { price: currentPrice, change, changePercent, history: points };
        }
        return null;
    } catch {
        return null;
    }
}

const YAHOO_SYMBOLS: Record<string, string> = {
    'USD-JPY': 'USDJPY=X',
    'EUR-JPY': 'EURJPY=X',
    'GBP-JPY': 'GBPJPY=X',
    'NI225:INDEXNIKKEI': '^N225',
    '.INX:INDEXSP': '^GSPC',
    '.DJI:INDEXDJX': '^DJI',
    '.IXIC:INDEXNASDAQ': '^IXIC',
    'BTC-USD': 'BTC-USD',
    'CL=F': 'CL=F',
};

async function fetchMarketData(): Promise<MarketData[]> {
    const results = await Promise.allSettled(
        GOOGLE_FINANCE_SYMBOLS.map(async (s) => {
            const yahooSymbol = YAHOO_SYMBOLS[s.gfSymbol];
            let quote: Quote | null = null;

            // 1. まず Yahoo Finance (高精度・公式API) を試す
            if (yahooSymbol) {
                quote = await fetchFromYahooChart(yahooSymbol);
            }

            // 2. 失敗したら Google Finance (スクレイピング) にフォールバック
            if (!quote && !s.gfSymbol.includes('=')) {
                quote = await fetchFromGoogleFinance(s.gfSymbol);
            }

            if (quote && quote.price > 0) {
                return {
                    symbol: s.gfSymbol,
                    name: s.name,
                    price: formatPrice(quote.price, s.gfSymbol),
                    change: quote.change >= 0 ? `+${quote.change.toFixed(2)}` : quote.change.toFixed(2),
                    changePercent: quote.changePercent >= 0 ? `+${quote.changePercent.toFixed(2)}%` : `${quote.changePercent.toFixed(2)}%`,
                    direction: (quote.change > 0 ? 'up' : quote.change < 0 ? 'down' : 'flat') as MarketData['direction'],
                    history: quote.history,
                };
            }

            return {
                symbol: s.gfSymbol,
                name: s.name,
                price: '--',
                change: '--',
                changePercent: '--',
                direction: 'flat' as const,
                history: [],
            };
        })
    );

    return results.map((r) => {
        if (r.status === 'fulfilled') return r.value;
        return { symbol: '', name: '', price: '--', change: '--', changePercent: '--', direction: 'flat' as const, history: [] };
    });
}

function formatPrice(price: number, symbol: string): string {
    if (!price) return '--';
    if (symbol.includes('JPY') || symbol.includes('NI225') || symbol.includes('NIKKEI')) {
        return price.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (symbol === 'CL=F') {
        return `$${price.toFixed(2)}`;
    }
    if (symbol.includes('BTC')) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 全クライアントが1分おきに叩くので、外部 API への問い合わせはサーバー側で1分に1回へまとめる
let memoryCache: { data: MarketData[]; updatedAt: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function GET() {
    const now = Date.now();
    const headers = { 'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=60' };

    if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
        return NextResponse.json({ data: memoryCache.data, updatedAt: memoryCache.updatedAt }, { headers });
    }

    try {
        const data = await fetchMarketData();
        const updatedAt = new Date().toISOString();
        // 全銘柄が取れなかった回は、直前の成功結果を上書きしない
        if (data.some(d => d.price !== '--') || !memoryCache) {
            memoryCache = { data, updatedAt, timestamp: now };
        }
        return NextResponse.json({ data: memoryCache.data, updatedAt: memoryCache.updatedAt }, { headers });
    } catch (error) {
        console.error('Market API Error:', error);
        if (memoryCache) {
            return NextResponse.json({ data: memoryCache.data, updatedAt: memoryCache.updatedAt });
        }
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
