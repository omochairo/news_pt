import type { WorldQuote } from './world-markets';

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

/** ニュース見出しと紐づける銘柄（/api/market の name と一致させる） */
export type RelatedSymbol = 'USD/JPY' | 'EUR/JPY' | '日経225' | 'S&P 500' | 'BTC/JPY' | '原油WTI';

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
 * ニュースのタイトルから関連する市場シンボルを検出する
 */
export function detectRelatedSymbol(title: string): RelatedSymbol | null {
    // 暗号資産の記事は「3億ドル」など金額表記でドルを含みやすいので、為替より先に判定する
    if (/ビットコイン|暗号資産|仮想通貨|Bitcoin|BTC|イーサリアム/i.test(title)) {
        return 'BTC/JPY';
    }
    // 「ドル」単体は金額表記に当たるので、為替の文脈を表す語に限る
    // 「1000円高」は株価の値幅、「ハードル高い」は為替ではないので除く（related-news.ts と同じ）
    if (/(?<![\d０-９万千百])円[安高]|円相場|為替|ドル円|(?<!ー)ドル[高安]|介入|\byen\b|USD\/?JPY/i.test(title)) {
        return 'USD/JPY';
    }
    if (/ユーロ円|ユーロ高|ユーロ安|EUR\/?JPY/i.test(title)) {
        return 'EUR/JPY';
    }
    if (/日経|TOPIX|東証|日本株|株価|日経平均|nikkei/i.test(title)) {
        return '日経225';
    }
    if (/S&P|ダウ|ナスダック|NASDAQ|米株|米国株|エヌビディア|アップル|テスラ/i.test(title)) {
        return 'S&P 500';
    }
    if (/原油|石油|WTI|Brent|OPEC|ガソリン/i.test(title)) {
        return '原油WTI';
    }

    return null;
}
