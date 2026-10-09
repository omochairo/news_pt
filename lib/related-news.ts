/**
 * ニュースの見出しから、関係する world-markets の銘柄（lib/world-markets.ts の MARKETS の symbol）を引く。
 * detectRelatedMarkets は当てはまる銘柄を全部返し（銘柄の詳細の関連ニュース用）、
 * detectPrimaryMarket は記事の下に出すチャート 1 本分を返す
 */

interface RelatedRule {
    pattern: RegExp;
    symbols: string[];
    /** 当てはまっても、見出しにこれがあれば外す（他国の話のとき） */
    unless?: RegExp;
    /**
     * 記事のチャートを 1 本選ぶときの優先度（小さいほど先。既定 2）。
     * 0: 暗号資産の通貨名（「3億ドル」など金額表記で為替に当たりやすいので先に見る）
     * 0.5: 通貨名の無い暗号資産の記事（「暗号資産市場でイーサリアムが急落」はイーサリアムを出す）
     * 1: 為替（「円高が進み、日経平均は反落」は為替の記事として扱う）
     * 3: 銘柄名そのものではなく、企業名・中銀・地政学などの連想で引くもの
     */
    priority?: number;
}

// 単語の境界が要る英字は \b で囲む（「GOLD」が「Goldman」に当たらないように）
const RULES: RelatedRule[] = [
    // 日本
    { pattern: /日経平均|日経225|日経先物|日本株|東証|東京株式|nikkei/i, symbols: ['^N225', 'NIY=F'] },
    { pattern: /TOPIX/i, symbols: ['1306.T'] },
    { pattern: /グロース市場|グロース250|東証グロース|新興株|マザーズ/, symbols: ['2516.T'] },
    // 米国
    { pattern: /ダウ平均|ダウ工業|NYダウ|ダウ先物|NY株|米国株式市場|ウォール街|\bDow\b|\bWall Street\b/i, symbols: ['^DJI', 'YM=F'] },
    { pattern: /ナスダック|NASDAQ/i, symbols: ['^IXIC', 'NQ=F'] },
    // 「S&P/ASX200」「S&P/TSX」は豪州・カナダの指数
    { pattern: /S&P(?!\/(ASX|TSX))|米国株|米株/i, symbols: ['^GSPC', 'ES=F'] },
    { pattern: /半導体|\bSOX\b|エヌビディア|Nvidia/i, symbols: ['^SOX'] },
    { pattern: /ラッセル|Russell 2000/i, symbols: ['^RUT'] },
    { pattern: /FANG|GAFAM|マグニフィセント|Magnificent Seven/i, symbols: ['^NYFANG'] },
    { pattern: /\bVIX\b|恐怖指数/i, symbols: ['^VIX'] },
    { pattern: /全世界株|オルカン|\bACWI\b/i, symbols: ['ACWI'] },
    // 為替・金利
    // 「2203円高」は株価の値幅なので、数字の直後の「円高・円安」は除く
    // 「ハードル高い」の「ドル高」に当てないよう、長音の直後の「ドル」は除く
    { pattern: /(?<![\d０-９万千百])円[安高]|円相場|ドル円|(?<!ー)ドル[高安]|為替介入|\byen\b|USD\/?JPY/i, symbols: ['JPY=X'], priority: 1 },
    { pattern: /ユーロ円|EUR\/?JPY/i, symbols: ['EURJPY=X'], priority: 1 },
    { pattern: /ユーロドル|ユーロ高|ユーロ安|EUR\/?USD|\beuro\b/i, symbols: ['EURUSD=X'], priority: 1 },
    { pattern: /ポンド|\bsterling\b|\bGBP\b/i, symbols: ['GBPJPY=X'], priority: 1 },
    { pattern: /豪ドル|\bAUD\b/, symbols: ['AUDJPY=X'], priority: 1 },
    { pattern: /米国債|米10年債|米長期金利|米金利|\bTreasur(y|ies)\b/i, symbols: ['^TNX'] },
    { pattern: /日本国債|円債|国債先物|\bJGB/i, symbols: ['JGB10Y'] },
    // 「長期金利」「10年債」だけでは国が分からないので、他国の名前が無い見出しに限って日本の国債とみなす
    { pattern: /長期金利|10年債/, symbols: ['JGB10Y'], unless: /米|ドイツ|独|英|欧州|ユーロ|仏|伊|豪|中国|NY|FRB|ECB/ },
    // 商品・暗号資産
    { pattern: /金価格|金相場|金先物|\bgold\b/i, symbols: ['GC=F'] },
    { pattern: /銀価格|銀相場|銀先物|\bsilver\b/i, symbols: ['SI=F'] },
    { pattern: /銅価格|銅相場|銅先物|\bcopper\b/i, symbols: ['HG=F'] },
    { pattern: /原油|石油|ガソリン|\bWTI\b|Brent|OPEC|\boil\b/i, symbols: ['CL=F'] },
    { pattern: /天然ガス|\bLNG\b|natural gas/i, symbols: ['NG=F'] },
    // 暗号資産は通貨ごとのチャートを出す。通貨名の無い業界・市場全体の記事だけ、代表としてビットコインを出す
    { pattern: /ビットコイン|bitcoin|\bBTC\b/i, symbols: ['BTC-JPY'], priority: 0 },
    // 「イーサネット」は除く
    { pattern: /イーサリアム|イーサ(?!ネット)|ethereum|\bETH\b/i, symbols: ['ETH-JPY'], priority: 0 },
    // 「リップル効果」（波及効果）は除く
    { pattern: /\bXRP\b|リップル(?!効果)|\bRipple\b/i, symbols: ['XRP-JPY'], priority: 0 },
    // 英字の「sol」は他の語に紛れるので、略号は大文字だけ
    { pattern: /ソラナ|Solana|\bSOL\b/, symbols: ['SOL-JPY'], priority: 0 },
    { pattern: /暗号資産|仮想通貨|\bcrypto|ステーブルコイン|コインベース|Coinbase|バイナンス|Binance/i, symbols: ['BTC-JPY', 'ETH-JPY'], priority: 0.5 },
    // アジア・オセアニア
    { pattern: /上海総合|中国株|上海株|本土株/, symbols: ['000001.SS'] },
    { pattern: /香港株|ハンセン|Hang Seng/i, symbols: ['^HSI'] },
    { pattern: /韓国株|KOSPI/i, symbols: ['^KS11'] },
    { pattern: /台湾株|台湾加権/, symbols: ['^TWII'] },
    { pattern: /インド株|Nifty|SENSEX/i, symbols: ['^NSEI'] },
    { pattern: /シンガポール株|\bSTI\b|ストレーツ・タイムズ/, symbols: ['^STI'] },
    { pattern: /マレーシア株|KLCI/i, symbols: ['^KLSE'] },
    { pattern: /タイ株|SET指数/, symbols: ['^SET.BK'] },
    { pattern: /インドネシア株|ジャカルタ総合/, symbols: ['^JKSE'] },
    { pattern: /ベトナム株|VN指数/, symbols: ['^VNINDEX.VN'] },
    { pattern: /豪州株|豪株|オーストラリア株|\bASX\b|ASX ?200/, symbols: ['^AORD'] },
    { pattern: /ニュージーランド株|NZ株|\bNZX\b/, symbols: ['^NZ50'] },
    // 欧州・中東・アフリカ
    // ロイターの見出しは英字が全角（「英ＦＴ指数」「独ＤＡＸ指数」）。「FTSE MIB」はイタリア
    { pattern: /英国株|FTSE(?! ?MIB)|ＦＴ指数/i, symbols: ['^FTSE'] },
    { pattern: /ドイツ株|\bDAX\b|ＤＡＸ/i, symbols: ['^GDAXI'] },
    { pattern: /フランス株|CAC ?40/i, symbols: ['^FCHI'] },
    { pattern: /イタリア株|FTSE ?MIB/i, symbols: ['FTSEMIB.MI'] },
    { pattern: /スイス株|\bSMI\b/, symbols: ['^SSMI'] },
    { pattern: /欧州株|ストックス|STOXX/i, symbols: ['^STOXX50E'] },
    { pattern: /トルコ株|トルコリラ|\bBIST\b/, symbols: ['XU100.IS'] },
    { pattern: /イスラエル株|テルアビブ/, symbols: ['TA35.TA'] },
    { pattern: /南アフリカ株|南ア株/, symbols: ['^J203.JO'] },
    { pattern: /サウジ株|\bTASI\b/, symbols: ['^TASI.SR'] },
    // 米州
    { pattern: /カナダ株|\bTSX\b/, symbols: ['^GSPTSE'] },
    { pattern: /メキシコ株|メキシコペソ/, symbols: ['^MXX'] },
    { pattern: /ブラジル株|ボベスパ|Bovespa/i, symbols: ['^BVSP'] },

    // ここから下は銘柄名そのものではなく、連想で引く（記事のチャートは上の銘柄名を優先する）
    // 日本の中銀・当局
    { pattern: /日銀|日本銀行|植田総裁|\bBOJ\b/i, symbols: ['JPY=X', 'JGB10Y'], priority: 3 },
    { pattern: /為替|介入|財務官/, symbols: ['JPY=X'], priority: 3 },
    // 日本の主力株
    { pattern: /トヨタ|ソニー|ソフトバンクG|ソフトバンクグループ|任天堂|ファーストリテイリング|ファストリ|三菱UFJ|三井住友FG|みずほFG|キーエンス|日立製作所|三菱商事|三井物産|伊藤忠|武田薬品|リクルート/, symbols: ['^N225'], priority: 3 },
    { pattern: /東京エレクトロン|東エレク|アドバンテスト|レーザーテック|ディスコ|ルネサス|キオクシア/, symbols: ['^SOX', '^N225'], priority: 3 },
    // 「株価」だけでは国が分からないので、他国の名前が無い見出しに限って日本株とみなす
    { pattern: /株価|株式市場|株高|株安/, symbols: ['^N225'], unless: /米|NY|欧州|英|独|仏|中国|香港|韓国|台湾|インド/, priority: 3 },
    // 米国の中銀・指標
    { pattern: /FRB|FOMC|パウエル|米連邦準備|\bFed\b|米雇用統計|米CPI|米消費者物価|米GDP|米小売売上高|米PCE/i, symbols: ['^TNX', 'JPY=X'], priority: 3 },
    // 米国の大型ハイテク株（「メタ」はメタン・メタルと紛れるので正式名だけ）
    { pattern: /アップル|\bApple\b|マイクロソフト|Microsoft|アマゾン|\bAmazon\b|アルファベット|グーグル|Google|メタ・プラットフォームズ|\bMeta\b|テスラ|Tesla|ネットフリックス|Netflix/i, symbols: ['^NYFANG', '^IXIC'], priority: 3 },
    { pattern: /ブロードコム|Broadcom|\bAMD\b|インテル|\bIntel\b|マイクロン|Micron|クアルコム|Qualcomm/i, symbols: ['^SOX'], priority: 3 },
    { pattern: /TSMC|台湾積体電路/, symbols: ['^TWII', '^SOX'], priority: 3 },
    { pattern: /サムスン|Samsung|SKハイニックス|SK hynix/i, symbols: ['^KS11', '^SOX'], priority: 3 },
    { pattern: /アリババ|Alibaba|テンセント|Tencent/i, symbols: ['^HSI'], priority: 3 },
    // 欧州の中銀
    { pattern: /\bECB\b|欧州中銀|欧州中央銀行|ラガルド/i, symbols: ['EURUSD=X'], priority: 3 },
    { pattern: /英中銀|イングランド銀行|\bBOE\b/i, symbols: ['GBPJPY=X'], priority: 3 },
    { pattern: /豪中銀|豪準備銀行|\bRBA\b/, symbols: ['AUDJPY=X'], priority: 3 },
    { pattern: /人民元|中国人民銀行|中国景気|中国経済/, symbols: ['000001.SS'], priority: 3 },
    // 産油地域の地政学（「サウジ株」は上の TASI）
    { pattern: /中東|イラン|ホルムズ|産油国|サウジアラビア|ベネズエラ/, symbols: ['CL=F'], priority: 3 },
    { pattern: /有事の金|安全資産/, symbols: ['GC=F'], priority: 3 },
];

export const RELATED_SYMBOLS = new Set(RULES.flatMap(r => r.symbols));

function matchedRules(title: string): RelatedRule[] {
    return RULES.filter(rule => rule.pattern.test(title) && !rule.unless?.test(title));
}

export function detectRelatedMarkets(title: string): string[] {
    return [...new Set(matchedRules(title).flatMap(rule => rule.symbols))];
}

/**
 * 記事の下に出すチャート 1 本。優先度の小さいルールから選び、同じ優先度なら見出しの前の方に出てくる語を取る
 * （「香港株寄り付き　反発、米金利低下が支え」は香港株の記事）
 */
export function detectPrimaryMarket(title: string): string | null {
    let best: { rule: RelatedRule; priority: number; at: number } | null = null;
    for (const rule of matchedRules(title)) {
        const priority = rule.priority ?? 2;
        const at = title.search(rule.pattern);
        if (!best || priority < best.priority || (priority === best.priority && at < best.at)) best = { rule, priority, at };
    }
    return best ? best.rule.symbols[0] : null;
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
