import { NewsItem } from './parser';

export interface TrendKeyword {
    word: string;
    count: number;
}

/** 除外するストップワード */
const STOP_WORDS = new Set([
    'ニュース', '記事', '速報', '更新', '日本', '米国', '今日', '明日',
    '発表', '実施', '検討', '対応', '対応とる', '見通し', '表明', '懸念',
    '影響', '拡大', '減少', '上昇', '下落', '低下', '改善', '悪化',
    '以上', '以下', '未満', '向け', '発言', '関連', '一部', '連続',
    '今年', '来年', '今月', '先月', '前年', '前月', '受け', '巡り',
    '目指す', '行う', '受ける', '受領', '開始', '新設', '急増', '急落',
]);

/** 優先抽出する重要用語キーワード（マッチすれば無条件で抽出） */
const FINANCIAL_PRIORITY_TERMS = [
    '163円', '160円', '155円', '円安', '円高', 'ドル高', 'ドル安',
    '日銀', 'FRB', 'FOMC', 'ECB', '利上げ', '利下げ', '政策金利',
    '介入', '為替介入', '国債', '原油', '半導体', 'エヌビディア',
    '日経平均', 'S&P500', 'ナスダック', '株高', '株安', '人工知能',
    'AI', 'ビットコイン', 'BTC', 'インフレ', 'CPI', '雇用統計',
    '決算', '減益', '増益', '最高益', '買収', 'M&A', 'リセッション',
    'ウクライナ', 'トランプ', 'バイデン', 'イラン', 'サウジ',
];

/**
 * 全ニュース記事のタイトルから上位トレンドキーワードを抽出しランキング化する
 */
export function extractTrendKeywords(items: NewsItem[], limit: number = 10): TrendKeyword[] {
    const wordCounts: Record<string, number> = {};

    for (const item of items) {
        const title = item.title;

        // 1. 優先キーワードのマッチング
        for (const term of FINANCIAL_PRIORITY_TERMS) {
            if (title.includes(term)) {
                wordCounts[term] = (wordCounts[term] || 0) + 2; // 重要語はカウント+2
            }
        }

        // 2. 簡易的な単語切り出し（全角・半角スペース、カギ括弧、記号等で分割）
        const tokens = title
            .replace(/[【】「」『』（）()[\]:：,、.。=＝/／!！?？\-_+＋~〜]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length >= 2);

        for (const token of tokens) {
            // 数字のみ、1文字、またはストップワードはスキップ
            if (/^\d+$/.test(token) || STOP_WORDS.has(token) || token.length < 2) {
                continue;
            }

            // 英字・日本語の一般的な単語カウント
            if (!FINANCIAL_PRIORITY_TERMS.includes(token)) {
                wordCounts[token] = (wordCounts[token] || 0) + 1;
            }
        }
    }

    // カウント順にソート
    const sorted = Object.entries(wordCounts)
        .map(([word, count]) => ({ word, count }))
        .filter(k => k.count >= 2) // 2回以上登場するものを優先
        .sort((a, b) => b.count - a.count);

    return sorted.slice(0, limit);
}
