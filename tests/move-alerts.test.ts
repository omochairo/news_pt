import { describe, expect, it } from 'vitest';
import { ALERT_SYMBOLS, AlertState, evaluateAlerts } from '../lib/move-alerts';
import { MARKETS } from '../lib/world-markets';

const q = (symbol: string, changePercent: number) => ({ symbol, changePercent });

/** 騰落率の列を順に流し、通知された段階を返す */
function run(series: number[], symbol = 'JPY=X'): number[] {
    let state: AlertState = {};
    const fired: number[] = [];
    for (const pct of series) {
        const { alerts, next } = evaluateAlerts([q(symbol, pct)], state);
        fired.push(...alerts.map(a => a.level));
        state = next;
    }
    return fired;
}

describe('evaluateAlerts', () => {
    it('対象は 24 時間ビューの銘柄', () => {
        const h24 = new Set(MARKETS.filter(m => m.h24).map(m => m.symbol));
        expect(ALERT_SYMBOLS.filter(s => !h24.has(s))).toEqual([]);
    });

    it('しきい値を超えたら 1 回だけ知らせ、同じ段階では繰り返さない', () => {
        expect(run([1.0, 2.1, 2.5, 2.9, 2.2])).toEqual([2]);
    });

    it('1% 刻みで広がったら知らせる', () => {
        expect(run([2.1, 3.2, 3.5, 4.0])).toEqual([2, 3, 4]);
    });

    it('しきい値付近の行き来では鳴らず、1.5% 未満に戻ったら解ける', () => {
        expect(run([2.1, 1.8, 2.2, 1.4, 2.0])).toEqual([2, 2]);
    });

    it('向きが反転したら知らせる', () => {
        expect(run([2.5, -2.1, -2.4])).toEqual([2, -2]);
    });

    it('対象外の銘柄・数値でない値は無視する', () => {
        expect(evaluateAlerts([q('^N225', 5), q('JPY=X', Number.NaN)], {})).toEqual({ alerts: [], next: {} });
    });
});
