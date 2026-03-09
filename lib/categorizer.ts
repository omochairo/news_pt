/**
 * キーワードベースのニュースカテゴリ自動分類
 */

export type NewsCategory = 'all' | 'fx' | 'stocks' | 'bonds' | 'commodities' | 'crypto' | 'economy';

export interface CategoryConfig {
    id: NewsCategory;
    label: string;
    labelEn: string;
    icon: string;
    keywords: string[];
}

export const CATEGORIES: CategoryConfig[] = [
    {
        id: 'all',
        label: 'すべて',
        labelEn: 'ALL',
        icon: '📰',
        keywords: [],
    },
    {
        id: 'fx',
        label: '為替・FX',
        labelEn: 'FX',
        icon: '💱',
        keywords: [
            '円', 'ドル', 'ユーロ', 'ポンド', '為替', 'FX', 'forex',
            'USD', 'JPY', 'EUR', 'GBP', 'AUD', 'CHF', 'CAD', 'NZD',
            'yen', 'dollar', 'euro', 'pound', 'currency', 'exchange rate',
            '通貨', '外国為替', '円安', '円高', 'ドル高', 'ドル安',
        ],
    },
    {
        id: 'stocks',
        label: '株式',
        labelEn: 'STOCKS',
        icon: '📈',
        keywords: [
            '株', '日経', 'TOPIX', 'S&P', 'ダウ', 'ナスダック', 'NASDAQ',
            '上場', 'IPO', '決算', '増収', '減収', '買収', 'M&A',
            '株価', '株式', '相場', 'stock', 'equity', 'share',
            'NYSE', 'earnings', '配当', 'dividend', '自社株買い',
            'Dow', 'Russell', 'hang seng', '恒生', 'DAX', 'FTSE',
        ],
    },
    {
        id: 'bonds',
        label: '債券・金利',
        labelEn: 'BONDS',
        icon: '🏛️',
        keywords: [
            '国債', '金利', '利回り', '債券', 'bond', 'yield', 'treasury',
            '利上げ', '利下げ', 'FRB', 'Fed', 'ECB', '日銀', 'BOJ',
            '中央銀行', '金融政策', 'monetary policy', 'interest rate',
            'FOMC', '量的緩和', 'QE', 'QT', '政策金利', 'rate hike',
            'rate cut', 'イールドカーブ', 'YCC',
        ],
    },
    {
        id: 'commodities',
        label: 'コモディティ',
        labelEn: 'CMDTY',
        icon: '🛢️',
        keywords: [
            '原油', '石油', 'oil', 'crude', '金', 'gold', '銀', 'silver',
            '天然ガス', 'natural gas', 'OPEC', 'WTI', 'Brent',
            '商品先物', 'commodity', '鉄鉱石', '銅', 'copper',
            'コモディティ', '穀物', '小麦', '大豆', 'wheat', 'corn',
        ],
    },
    {
        id: 'crypto',
        label: '暗号資産',
        labelEn: 'CRYPTO',
        icon: '₿',
        keywords: [
            'ビットコイン', 'Bitcoin', 'BTC', 'イーサリアム', 'Ethereum', 'ETH',
            '暗号資産', '仮想通貨', 'crypto', 'blockchain', 'ブロックチェーン',
            'DeFi', 'NFT', 'Web3', 'リップル', 'XRP', 'ソラナ', 'SOL',
            'ステーブルコイン', '暗号通貨', 'デジタル資産', 'token',
        ],
    },
    {
        id: 'economy',
        label: '経済指標',
        labelEn: 'ECON',
        icon: '📊',
        keywords: [
            'GDP', 'CPI', 'インフレ', 'デフレ', '雇用統計', '失業率',
            'PMI', 'ISM', '消費者物価', '生産者物価', '景気',
            '経済成長', '貿易収支', '経常収支', 'inflation', 'deflation',
            '小売売上', '鉄鋼生産', '住宅着工', '消費者信頼感',
            'payroll', 'employment', 'recession', '景気後退',
        ],
    },
];

/**
 * 記事タイトルからカテゴリを自動判定する
 * 複数カテゴリに該当する場合は、最もマッチ数が多いカテゴリを返す
 */
export function categorizeArticle(title: string): NewsCategory {
    const lowerTitle = title.toLowerCase();
    let bestCategory: NewsCategory = 'economy'; // デフォルト
    let bestScore = 0;

    for (const cat of CATEGORIES) {
        if (cat.id === 'all') continue;

        let score = 0;
        for (const keyword of cat.keywords) {
            if (lowerTitle.includes(keyword.toLowerCase())) {
                score++;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestCategory = cat.id;
        }
    }

    return bestCategory;
}

/**
 * カテゴリ設定を ID で取得する
 */
export function getCategoryConfig(id: NewsCategory): CategoryConfig {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[0];
}
