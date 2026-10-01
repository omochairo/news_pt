import { describe, expect, it } from 'vitest';
import { parseFavorites, toggleFavorite } from '../lib/favorites';
import { MARKETS } from '../lib/world-markets';

const [a, b, c] = MARKETS.map(m => m.symbol);

describe('parseFavorites', () => {
    it('空・壊れた値・配列でない値はお気に入りなし', () => {
        expect(parseFavorites(null)).toEqual([]);
        expect(parseFavorites('')).toEqual([]);
        expect(parseFavorites('{')).toEqual([]);
        expect(parseFavorites('{"a":1}')).toEqual([]);
    });

    it('銘柄表に無い銘柄・文字列でない値・重複を捨て、銘柄表の順に並べる', () => {
        expect(parseFavorites(JSON.stringify([c, 'NO_SUCH', 1, a, c]))).toEqual([a, c]);
    });
});

describe('toggleFavorite', () => {
    it('無ければ足し、あれば外す。並びは銘柄表の順', () => {
        const added = toggleFavorite([c], a);
        expect(added).toEqual([a, c]);
        expect(toggleFavorite(added, b)).toEqual([a, b, c]);
        expect(toggleFavorite(added, c)).toEqual([a]);
    });
});
