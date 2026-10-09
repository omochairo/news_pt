import { MARKETS, WorldQuote, formatChange, formatPrice } from './world-markets';
import { RELATED_SYMBOLS } from './related-news';

/** /api/market が返す1銘柄分のデータ */
export interface SymbolMarketData {
    symbol: string;
    name: string;
    price: string;
    change: string;
    changePercent: string;
    direction: 'up' | 'down' | 'flat';
    history: number[]; // Sparkline 用のイントラデイ終値（古い順）
}

/**
 * ニュース画面のティッカーに出す銘柄。値は /api/world-markets と同じ取得・キャッシュから出す
 * （symbol は lib/world-markets.ts の MARKETS にあるものに限る）
 */
export const TICKER_SYMBOLS: { symbol: string; name: string; format: 'ja' | 'en' | 'usd' | 'int' }[] = [
    { symbol: 'JPY=X', name: 'USD/JPY', format: 'ja' },
    { symbol: 'EURJPY=X', name: 'EUR/JPY', format: 'ja' },
    { symbol: 'GBPJPY=X', name: 'GBP/JPY', format: 'ja' },
    { symbol: '^N225', name: '日経225', format: 'ja' },
    { symbol: '^GSPC', name: 'S&P 500', format: 'en' },
    { symbol: '^DJI', name: 'ダウ平均', format: 'en' },
    { symbol: '^IXIC', name: 'NASDAQ', format: 'en' },
    { symbol: 'BTC-JPY', name: 'BTC/JPY', format: 'int' },
    { symbol: 'CL=F', name: '原油WTI', format: 'usd' },
];

function formatTickerPrice(price: number, format: (typeof TICKER_SYMBOLS)[number]['format']): string {
    switch (format) {
        case 'ja':
            return price.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        case 'usd':
            return `$${price.toFixed(2)}`;
        case 'int':
            return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
        default:
            return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}

const signed = (v: number) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

/** world-markets の値をティッカーの形に直す。取れていない銘柄は '--' */
export function toTickerData(quotes: Record<string, WorldQuote>): SymbolMarketData[] {
    return TICKER_SYMBOLS.map(({ symbol, name, format }) => {
        const q = quotes[symbol];
        if (!q || !(q.price > 0)) {
            return { symbol, name, price: '--', change: '--', changePercent: '--', direction: 'flat', history: [] };
        }
        return {
            symbol,
            name,
            price: formatTickerPrice(q.price, format),
            change: signed(q.change),
            changePercent: `${signed(q.changePercent)}%`,
            direction: q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'flat',
            history: q.history,
        };
    });
}

/**
 * 記事の下のチャート用。見出しと紐づく銘柄（related-news.ts の RELATED_SYMBOLS）を、
 * /markets と同じ名前・桁で直す。取れていない銘柄は返さない
 */
export function toRelatedData(quotes: Record<string, WorldQuote>): SymbolMarketData[] {
    return MARKETS.filter(def => RELATED_SYMBOLS.has(def.symbol) && quotes[def.symbol]?.price > 0).map(def => {
        const q = quotes[def.symbol];
        return {
            symbol: def.symbol,
            name: def.name,
            price: formatPrice(q.price, def),
            change: formatChange(q.change, def.decimals ?? 2),
            changePercent: `${formatChange(q.changePercent, 2)}%`,
            direction: q.change > 0 ? 'up' : q.change < 0 ? 'down' : 'flat',
            history: q.history,
        };
    });
}
