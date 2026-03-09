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
}

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
];

async function fetchFromGoogleFinance(gfSymbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
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
                return { price, change, changePercent };
            }
        }

        // フォールバック: テキストから取得
        const priceText = $('[class*="YMlKec fxKbKc"]').first().text().replace(/[,¥$€£]/g, '');
        const price = parseFloat(priceText);
        if (price > 0) {
            return { price, change: 0, changePercent: 0 };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Yahoo Finance v8 chart API (バックアップ)
 */
async function fetchFromYahooChart(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 5000,
        });

        const meta = response.data?.chart?.result?.[0]?.meta;
        if (!meta) return null;

        const currentPrice = meta.regularMarketPrice;
        const previousClose = meta.chartPreviousClose || meta.previousClose;

        if (currentPrice != null && previousClose != null && previousClose !== 0) {
            const change = currentPrice - previousClose;
            const changePercent = (change / previousClose) * 100;
            return { price: currentPrice, change, changePercent };
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
};

async function fetchMarketData(): Promise<MarketData[]> {
    const results = await Promise.allSettled(
        GOOGLE_FINANCE_SYMBOLS.map(async (s) => {
            const yahooSymbol = YAHOO_SYMBOLS[s.gfSymbol];
            let quote: { price: number; change: number; changePercent: number } | null = null;

            // 1. まず Yahoo Finance (高精度・公式API) を試す
            if (yahooSymbol) {
                quote = await fetchFromYahooChart(yahooSymbol);
            }

            // 2. 失敗したら Google Finance (スクレイピング) にフォールバック
            if (!quote) {
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
                };
            }

            return {
                symbol: s.gfSymbol,
                name: s.name,
                price: '--',
                change: '--',
                changePercent: '--',
                direction: 'flat' as const,
            };
        })
    );

    return results.map((r) => {
        if (r.status === 'fulfilled') return r.value;
        return { symbol: '', name: '', price: '--', change: '--', changePercent: '--', direction: 'flat' as const };
    });
}

function formatPrice(price: number, symbol: string): string {
    if (!price) return '--';
    if (symbol.includes('JPY') || symbol.includes('NI225') || symbol.includes('NIKKEI')) {
        return price.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (symbol.includes('BTC')) {
        return price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET() {
    try {
        const data = await fetchMarketData();
        return NextResponse.json({ data, updatedAt: new Date().toISOString() });
    } catch (error) {
        console.error('Market API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
