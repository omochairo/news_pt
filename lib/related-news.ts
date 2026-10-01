/**
 * ニュースの見出しから、関係する world-markets の銘柄（lib/world-markets.ts の MARKETS の symbol）を引く。
 * 記事の Sparkline 用の detectRelatedSymbol（1 記事 1 銘柄）と違い、当てはまる銘柄を全部返す
 */

interface RelatedRule {
    pattern: RegExp;
    symbols: string[];
}

// 単語の境界が要る英字は \b で囲む（「GOLD」が「Goldman」に当たらないように）
const RULES: RelatedRule[] = [
    // 日本
    { pattern: /日経平均|日経225|日経先物|日本株|東証|東京株式|nikkei/i, symbols: ['^N225', 'NIY=F'] },
    { pattern: /TOPIX/i, symbols: ['1306.T'] },
    { pattern: /グロース市場|グロース250|東証グロース/, symbols: ['2516.T'] },
    // 米国
    { pattern: /ダウ平均|ダウ工業|NYダウ|ダウ先物|\bDow\b/i, symbols: ['^DJI', 'YM=F'] },
    { pattern: /ナスダック|NASDAQ/i, symbols: ['^IXIC', 'NQ=F'] },
    { pattern: /S&P|米国株|米株/i, symbols: ['^GSPC', 'ES=F'] },
    { pattern: /半導体|\bSOX\b|エヌビディア|Nvidia/i, symbols: ['^SOX'] },
    { pattern: /ラッセル|Russell 2000/i, symbols: ['^RUT'] },
    { pattern: /\bVIX\b|恐怖指数/i, symbols: ['^VIX'] },
    // 為替・金利
    // 「2203円高」は株価の値幅なので、数字の直後の「円高・円安」は除く
    { pattern: /(?<![\d０-９万千百])円[安高]|円相場|ドル円|ドル高|ドル安|為替介入|\byen\b|USD\/?JPY/i, symbols: ['JPY=X'] },
    { pattern: /ユーロ円|EUR\/?JPY/i, symbols: ['EURJPY=X'] },
    { pattern: /ユーロドル|ユーロ高|ユーロ安|EUR\/?USD|\beuro\b/i, symbols: ['EURUSD=X'] },
    { pattern: /ポンド|\bsterling\b|\bGBP\b/i, symbols: ['GBPJPY=X'] },
    { pattern: /豪ドル|\bAUD\b/, symbols: ['AUDJPY=X'] },
    { pattern: /米国債|米国債利回り|米長期金利|10年債|\bTreasur(y|ies)\b/i, symbols: ['^TNX'] },
    // 商品・暗号資産
    { pattern: /金価格|金相場|金先物|\bgold\b/i, symbols: ['GC=F'] },
    { pattern: /銀価格|銀相場|銀先物|\bsilver\b/i, symbols: ['SI=F'] },
    { pattern: /銅価格|銅相場|銅先物|\bcopper\b/i, symbols: ['HG=F'] },
    { pattern: /原油|石油|\bWTI\b|Brent|OPEC|\boil\b/i, symbols: ['CL=F'] },
    { pattern: /天然ガス|\bLNG\b|natural gas/i, symbols: ['NG=F'] },
    { pattern: /ビットコイン|bitcoin|\bBTC\b/i, symbols: ['BTC-JPY'] },
    { pattern: /イーサリアム|ethereum|\bETH\b/i, symbols: ['ETH-JPY'] },
    { pattern: /暗号資産|仮想通貨|\bcrypto/i, symbols: ['BTC-JPY', 'ETH-JPY'] },
    // アジア・欧州
    { pattern: /上海総合|中国株|上海株/, symbols: ['000001.SS'] },
    { pattern: /香港株|ハンセン|Hang Seng/i, symbols: ['^HSI'] },
    { pattern: /韓国株|KOSPI/i, symbols: ['^KS11'] },
    { pattern: /台湾株|台湾加権/, symbols: ['^TWII'] },
    { pattern: /インド株|Nifty|SENSEX/i, symbols: ['^NSEI'] },
    // ロイターの見出しは英字が全角（「英ＦＴ指数」「独ＤＡＸ指数」）
    { pattern: /英国株|FTSE|ＦＴ指数/i, symbols: ['^FTSE'] },
    { pattern: /ドイツ株|\bDAX\b|ＤＡＸ/i, symbols: ['^GDAXI'] },
    { pattern: /フランス株|CAC ?40/i, symbols: ['^FCHI'] },
    { pattern: /欧州株|ストックス|STOXX/i, symbols: ['^STOXX50E'] },
];

export const RELATED_SYMBOLS = new Set(RULES.flatMap(r => r.symbols));

export function detectRelatedMarkets(title: string): string[] {
    const found = new Set<string>();
    for (const rule of RULES) {
        if (rule.pattern.test(title)) rule.symbols.forEach(s => found.add(s));
    }
    return [...found];
}

/** 記事の並びのまま、その銘柄に関係する記事を最大 limit 件。同じ URL は 1 件にする */
export function pickRelatedNews<T extends { title: string; url: string }>(items: T[], symbol: string, limit = 8): T[] {
    const seen = new Set<string>();
    const picked: T[] = [];
    for (const item of items) {
        if (picked.length >= limit) break;
        if (seen.has(item.url) || !detectRelatedMarkets(item.title).includes(symbol)) continue;
        seen.add(item.url);
        picked.push(item);
    }
    return picked;
}
