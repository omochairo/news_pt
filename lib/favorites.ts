import { MARKETS } from './world-markets';

export const FAVORITES_STORAGE_KEY = 'vantage-point-markets-favorites';

const KNOWN = new Set(MARKETS.map(m => m.symbol));

/**
 * 保存値を銘柄リストに戻す。壊れた値・銘柄表から消えた銘柄・重複は捨てる。
 * 並びは銘柄表（MARKETS）の順にそろえる
 */
export function parseFavorites(raw: string | null): string[] {
    if (!raw) return [];
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(value)) return [];
    return inMarketOrder(new Set(value.filter((s): s is string => typeof s === 'string' && KNOWN.has(s))));
}

function inMarketOrder(picked: Set<string>): string[] {
    return MARKETS.map(m => m.symbol).filter(s => picked.has(s));
}

export function toggleFavorite(favorites: string[], symbol: string): string[] {
    const next = new Set(favorites);
    if (next.has(symbol)) next.delete(symbol);
    else next.add(symbol);
    return inMarketOrder(next);
}

// 端末ごとの好みなので localStorage。使えない環境（プライベートモード等）ではお気に入りなし
export function readFavorites(): string[] {
    try {
        return parseFavorites(localStorage.getItem(FAVORITES_STORAGE_KEY));
    } catch {
        return [];
    }
}

export function saveFavorites(favorites: string[]) {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
        // 保存できなくても、開いている間は表示に反映される
    }
}
