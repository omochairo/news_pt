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
export type RelatedSymbol = 'USD/JPY' | 'EUR/JPY' | '日経225' | 'S&P 500' | 'BTC/USD' | '原油WTI';

/**
 * ニュースのタイトルから関連する市場シンボルを検出する
 */
export function detectRelatedSymbol(title: string): RelatedSymbol | null {
    if (/円安|円高|円相場|為替|ドル円|ドル|介入|FX|yen|dollar/i.test(title)) {
        return 'USD/JPY';
    }
    if (/ユーロ|euro|EUR/i.test(title)) {
        return 'EUR/JPY';
    }
    if (/日経|TOPIX|東証|日本株|株価|日経平均|nikkei/i.test(title)) {
        return '日経225';
    }
    if (/S&P|ダウ|ナスダック|NASDAQ|米株|米国株|エヌビディア|アップル|テスラ/i.test(title)) {
        return 'S&P 500';
    }
    if (/ビットコイン|暗号資産|仮想通貨|Bitcoin|BTC|イーサリアム/i.test(title)) {
        return 'BTC/USD';
    }
    if (/原油|石油|WTI|Brent|OPEC|ガソリン/i.test(title)) {
        return '原油WTI';
    }

    return null;
}
