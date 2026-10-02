import type { HistoryRange, QuoteHistory, WorldQuote } from './world-markets';

/**
 * 日本国債 10 年利回り。Yahoo Finance に無いので、財務省「国債金利情報」の CSV（日次の終値）から作る。
 * 財務省サイトのコンテンツは公共データ利用規約（PDL1.0）で、出典を書けば加工・再配信してよい。
 * https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm
 */

export const JGB10Y_SYMBOL = 'JGB10Y';
/** 当月分（月初は前月末までの行が無い）と、昭和 49 年からの全期間（約 1.2MB） */
export const MOF_CURRENT_CSV = 'https://www.mof.go.jp/jgbs/reference/interest_rate/jgbcm.csv';
export const MOF_ALL_CSV = 'https://www.mof.go.jp/jgbs/reference/interest_rate/data/jgbcm_all.csv';

export interface JgbRow {
    date: string;   // YYYY-MM-DD（基準日）
    y10: number;    // 10 年の利回り（%）
}

const ERA_START: Record<string, number> = { M: 1867, T: 1911, S: 1925, H: 1988, R: 2018 };
const TENOR_10Y_COLUMN = 10; // 基準日,1年,...,9年,10年 → 0 始まりで 10 列目

/**
 * CSV を行に直す。見出し（Shift_JIS の日本語）は読まずに捨て、和暦の日付で始まる行だけを使う。
 * 10 年の欄が「-」（発行の無かった時期）や空の行は捨てる。日付の古い順
 */
export function parseMofCsv(text: string): JgbRow[] {
    const rows: JgbRow[] = [];
    for (const line of text.split(/\r?\n/)) {
        const cells = line.split(',');
        const m = /^([MTSHR])(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(cells[0]?.trim() ?? '');
        if (!m) continue;
        const value = Number(cells[TENOR_10Y_COLUMN]);
        if (cells[TENOR_10Y_COLUMN]?.trim() === '' || !Number.isFinite(value)) continue;
        const year = ERA_START[m[1]] + Number(m[2]);
        rows.push({ date: `${year}-${m[3].padStart(2, '0')}-${m[4].padStart(2, '0')}`, y10: value });
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** 2 つの行の一覧を日付で重ね、同じ日は後ろ（新しく取った方）を使う */
export function mergeRows(older: JgbRow[], newer: JgbRow[]): JgbRow[] {
    const byDate = new Map(older.map(r => [r.date, r]));
    for (const r of newer) byDate.set(r.date, r);
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// 基準日の終値は東京の取引終了（15:00 JST）時点の値として扱う
const closeAt = (date: string) => `${date}T06:00:00.000Z`;

const QUOTE_HISTORY_DAYS = 20;

/** 最新の行を現在値、その前の行を前日として WorldQuote にする。行が 2 つ未満なら null */
export function toJgbQuote(rows: JgbRow[]): WorldQuote | null {
    if (rows.length < 2) return null;
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const change = last.y10 - prev.y10;
    return {
        symbol: JGB10Y_SYMBOL,
        price: last.y10,
        previousClose: prev.y10,
        change,
        changePercent: prev.y10 === 0 ? 0 : (change / Math.abs(prev.y10)) * 100,
        // タイルのチャートは直近 20 営業日の推移（日中の値は無い）
        history: rows.slice(-QUOTE_HISTORY_DAYS).map(r => r.y10),
        lastTradeAt: closeAt(last.date),
        // 取引時間の概念が無い日次データなので、常に「時間外」として扱う
    };
}

/** 詳細チャート用。期間は営業日の本数で切る（日次データなので 5 日は 5 本） */
const RANGE_ROWS: Record<HistoryRange, number> = { '5d': 5, '1mo': 22, '1y': 245 };

export function toJgbHistory(rows: JgbRow[], range: HistoryRange): QuoteHistory | null {
    const slice = rows.slice(-RANGE_ROWS[range]);
    if (slice.length < 2) return null;
    const first = slice[0].y10;
    const last = slice[slice.length - 1].y10;
    const values = slice.map(r => r.y10);
    return {
        symbol: JGB10Y_SYMBOL,
        range,
        points: slice.map(r => ({ t: closeAt(r.date), v: r.y10 })),
        first,
        last,
        change: last - first,
        changePercent: first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100,
        high: Math.max(...values),
        low: Math.min(...values),
    };
}
