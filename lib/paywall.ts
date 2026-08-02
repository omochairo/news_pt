import { NewsItem } from './parser';

export interface PaywallInfo {
    isPaywall: boolean;
    label: string;
}

const PAYWALL_KEYWORDS = [
    '有料会員', '有料記事', '会員限定', '有料', '購読者限定',
    'ペイウォール', 'paywall', 'subscribers', 'premium',
];

/**
 * ニュース記事が有料記事・会員限定（Paywall）かどうか判定する
 */
export function checkPaywall(item: NewsItem): PaywallInfo {
    const { source, title, url } = item;

    // 1. Bloomberg 記事は全件原則有料（閲覧制限あり）
    if (source === 'Bloomberg') {
        return { isPaywall: true, label: '🔒 有料記事' };
    }

    // 2. 日経新聞 (Nikkei) でキーワードまたは特定の記事パターン
    if (source === 'Nikkei') {
        if (
            title.includes('有料') ||
            title.includes('会員限定') ||
            title.includes('［有料会員限定］') ||
            title.includes('（有料）')
        ) {
            return { isPaywall: true, label: '🔒 有料会員限定' };
        }
        // 日経新聞の総合・マーケット速報の一部も実質会員限定の場合が多いため判定
        if (url.includes('/article/') && !url.includes('/nkd/')) {
            return { isPaywall: true, label: '🔒 有料記事' };
        }
    }

    // 3. キーワード判定
    const lowerTitle = title.toLowerCase();
    for (const kw of PAYWALL_KEYWORDS) {
        if (title.includes(kw) || lowerTitle.includes(kw)) {
            return { isPaywall: true, label: '🔒 有料記事' };
        }
    }

    return { isPaywall: false, label: '' };
}
