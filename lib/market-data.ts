export interface SymbolMarketData {
    symbol: string;
    name: string;
    price: string;
    changePercent: string;
    direction: 'up' | 'down' | 'flat';
    history: number[]; // Sparkline用 10〜12個のトレンドポイント (例: 100をベースにした指数)
}

export const SYMBOL_MARKET_MAP: Record<string, SymbolMarketData> = {
    'USD/JPY': {
        symbol: 'USD/JPY',
        name: 'USD/JPY',
        price: '163.25',
        changePercent: '+0.42%',
        direction: 'up',
        history: [162.1, 162.3, 162.2, 162.6, 162.9, 163.1, 163.0, 163.4, 163.25],
    },
    'EUR/JPY': {
        symbol: 'EUR/JPY',
        name: 'EUR/JPY',
        price: '176.80',
        changePercent: '-0.15%',
        direction: 'down',
        history: [177.2, 177.1, 177.4, 177.0, 176.9, 176.7, 176.8, 176.80],
    },
    '日経225': {
        symbol: 'NI225',
        name: '日経225',
        price: '39,450.00',
        changePercent: '+1.25%',
        direction: 'up',
        history: [38900, 39050, 39120, 39200, 39180, 39350, 39450],
    },
    'S&P 500': {
        symbol: 'SPX',
        name: 'S&P 500',
        price: '5,560.20',
        changePercent: '+0.68%',
        direction: 'up',
        history: [5520, 5530, 5545, 5540, 5555, 5560.2],
    },
    'BTC/USD': {
        symbol: 'BTC/USD',
        name: 'BTC/USD',
        price: '67,420',
        changePercent: '-1.10%',
        direction: 'down',
        history: [68400, 68100, 67900, 67600, 67800, 67420],
    },
    '原油WTI': {
        symbol: 'WTI',
        name: '原油 WTI',
        price: '$82.40',
        changePercent: '+2.15%',
        direction: 'up',
        history: [80.5, 80.8, 81.2, 81.6, 82.1, 82.40],
    },
};

/**
 * ニュースのタイトルから関連する市場シンボルを検出する
 */
export function detectRelatedSymbol(title: string): SymbolMarketData | null {
    const lower = title.toLowerCase();

    if (/円安|円高|為替|ドル|163円|160円|155円|介入|葉梨|FX|yen|dollar/i.test(lower)) {
        return SYMBOL_MARKET_MAP['USD/JPY'];
    }
    if (/ユーロ|euro|EUR/i.test(lower)) {
        return SYMBOL_MARKET_MAP['EUR/JPY'];
    }
    if (/日経|TOPIX|東証|日本株|株価|日経平均|nikkei/i.test(lower)) {
        return SYMBOL_MARKET_MAP['日経225'];
    }
    if (/S&P|ダウ|ナスダック|NASDAQ|米株|米国株|エヌビディア|アップル|テスラ/i.test(lower)) {
        return SYMBOL_MARKET_MAP['S&P 500'];
    }
    if (/ビットコイン|暗号資産|仮想通貨|Bitcoin|BTC|イーサリアム/i.test(lower)) {
        return SYMBOL_MARKET_MAP['BTC/USD'];
    }
    if (/原油|石油|WTI|Brent|OPEC|ガソリン/i.test(lower)) {
        return SYMBOL_MARKET_MAP['原油WTI'];
    }

    return null;
}
