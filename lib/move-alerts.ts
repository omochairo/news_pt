/**
 * 大きな変動の通知（ページを開いている間だけ）。24 時間の騰落率がしきい値を超えたら知らせる。
 * 判定は純粋関数にして、通知済みの状態は呼び出し側（localStorage）で持つ
 */

/** 通知の対象（24 時間ビューの銘柄から） */
export const ALERT_SYMBOLS = ['NIY=F', 'JPY=X', 'BTC-JPY'];
export const ALERT_THRESHOLD = 2;
// しきい値付近を行き来するたびに鳴らないよう、ここまで戻ったら「通知済み」を解く
export const ALERT_RESET_BELOW = 1.5;

/** 銘柄ごとに、最後に知らせた段階（+2 なら +2% 台で通知済み、-3 なら -3% 台） */
export type AlertState = Record<string, number>;

export interface MoveAlert {
    symbol: string;
    changePercent: number;
    level: number;
}

/**
 * しきい値を超えたとき、さらに 1% 刻みで広がったとき、向きが反転したときに 1 回ずつ知らせる。
 * 同じ段階にいる間は繰り返さない
 */
export function evaluateAlerts(
    quotes: { symbol: string; changePercent: number }[],
    state: AlertState,
    symbols: string[] = ALERT_SYMBOLS,
): { alerts: MoveAlert[]; next: AlertState } {
    const next: AlertState = { ...state };
    const alerts: MoveAlert[] = [];

    for (const q of quotes) {
        if (!symbols.includes(q.symbol) || !Number.isFinite(q.changePercent)) continue;
        const abs = Math.abs(q.changePercent);
        const prev = state[q.symbol] ?? 0;

        if (abs < ALERT_RESET_BELOW) {
            delete next[q.symbol];
            continue;
        }
        if (abs < ALERT_THRESHOLD) continue;

        const level = Math.floor(abs) * Math.sign(q.changePercent);
        if (Math.sign(level) !== Math.sign(prev) || Math.abs(level) > Math.abs(prev)) {
            alerts.push({ symbol: q.symbol, changePercent: q.changePercent, level });
            next[q.symbol] = level;
        }
    }
    return { alerts, next };
}

// --- 設定と状態の保存（端末ごと） ---

export const ALERTS_ENABLED_KEY = 'vantage-point-move-alerts';
export const ALERTS_STATE_KEY = 'vantage-point-move-alerts-state';
/** 同じページ内で設定が変わったことを知らせるイベント（別タブには storage イベントで届く） */
export const ALERTS_CHANGE_EVENT = 'vantage-point-move-alerts-change';

export function readAlertsEnabled(): boolean {
    try {
        return localStorage.getItem(ALERTS_ENABLED_KEY) === 'on';
    } catch {
        return false;
    }
}

export function saveAlertsEnabled(enabled: boolean) {
    try {
        if (enabled) localStorage.setItem(ALERTS_ENABLED_KEY, 'on');
        else localStorage.removeItem(ALERTS_ENABLED_KEY);
    } catch {
        // 保存できなくても、このページを開いている間は効く
    }
    window.dispatchEvent(new Event(ALERTS_CHANGE_EVENT));
}

export function readAlertState(): AlertState {
    try {
        const value: unknown = JSON.parse(localStorage.getItem(ALERTS_STATE_KEY) ?? '{}');
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)));
    } catch {
        return {};
    }
}

export function saveAlertState(state: AlertState) {
    try {
        localStorage.setItem(ALERTS_STATE_KEY, JSON.stringify(state));
    } catch {
        // 保存できないと、再読み込みのたびに同じ通知が出うる
    }
}
