/**
 * ニュース記事の重要度スコアリング
 * タイトルのキーワードから BREAKING / HIGH / NORMAL を判定
 */

export type ImportanceLevel = 'breaking' | 'high' | 'normal';

export interface ImportanceConfig {
    level: ImportanceLevel;
    label: string;
    color: string;
    bgColor: string;
    glowColor: string;
}

export const IMPORTANCE_CONFIGS: Record<ImportanceLevel, ImportanceConfig> = {
    breaking: {
        level: 'breaking',
        label: 'BREAKING',
        color: '#ff4444',
        bgColor: 'rgba(255, 68, 68, 0.15)',
        glowColor: 'rgba(255, 68, 68, 0.4)',
    },
    high: {
        level: 'high',
        label: 'HIGH',
        color: '#ff8800',
        bgColor: 'rgba(255, 136, 0, 0.12)',
        glowColor: 'rgba(255, 136, 0, 0.3)',
    },
    normal: {
        level: 'normal',
        label: '',
        color: '',
        bgColor: '',
        glowColor: '',
    },
};

/** 速報・市場急変動を示すキーワード */
const BREAKING_KEYWORDS = [
    '速報', '緊急', '暴落', '急落', '急騰', '最高値', '最安値',
    '過去最高', '史上最高', '史上初', 'breaking', 'alert',
    '戦争', '制裁', 'デフォルト', '破綻', '倒産', '解任',
    '利上げ決定', '利下げ決定', '緊急利上げ', '介入',
    'flash crash', 'circuit breaker', 'サーキットブレーカー',
];

/** 高い市場インパクトを示すキーワード */
const HIGH_KEYWORDS = [
    '日銀', 'FRB', 'Fed', 'ECB', 'BOE', 'FOMC',
    '金融政策', '利上げ', '利下げ', '政策金利',
    '決算', '業績', '買収', 'M&A', 'IPO',
    'GDP', 'CPI', '雇用統計', 'インフレ',
    '制裁', '関税', '規制', 'サミット',
    '原油', '金価格', '急上昇', '急低下',
    'リセッション', '景気後退',
];

/**
 * タイトルから重要度を判定する
 */
export function scoreImportance(title: string): ImportanceLevel {
    const lower = title.toLowerCase();

    // BREAKING判定
    for (const kw of BREAKING_KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) {
            return 'breaking';
        }
    }

    // HIGH判定（2つ以上のHIGHキーワードがあればHIGH）
    let highCount = 0;
    for (const kw of HIGH_KEYWORDS) {
        if (lower.includes(kw.toLowerCase())) {
            highCount++;
        }
    }
    if (highCount >= 1) {
        return 'high';
    }

    return 'normal';
}
