import axios from 'axios';
import { JgbRow, MOF_ALL_CSV, MOF_CURRENT_CSV, mergeRows, parseMofCsv, toJgbHistory, toJgbQuote } from './jgb';
import type { HistoryRange, QuoteHistory, WorldQuote } from './world-markets';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 日次（翌営業日の朝に更新）なので長めに持つ。全期間の CSV は約 1.2MB あるので、要るときだけ取る
const CURRENT_TTL_MS = 60 * 60 * 1000;
const ALL_TTL_MS = 6 * 60 * 60 * 1000;

/** 期限つきキャッシュと同時要求の集約。取れなかったときは古い値があればそれを使う */
function cachedRows(url: string, ttl: number) {
    let cache: { rows: JgbRow[]; at: number } | null = null;
    let inflight: Promise<JgbRow[]> | null = null;

    return async function load(): Promise<JgbRow[]> {
        if (cache && Date.now() - cache.at < ttl) return cache.rows;
        try {
            if (!inflight) {
                inflight = axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 10000, responseType: 'text' })
                    .then(res => parseMofCsv(String(res.data)))
                    .finally(() => { inflight = null; });
            }
            const rows = await inflight;
            cache = { rows, at: Date.now() };
            return rows;
        } catch (error) {
            console.error(`MOF CSV fetch failed for ${url}:`, error instanceof Error ? error.message : error);
            if (cache) return cache.rows;
            throw error;
        }
    };
}

const loadCurrent = cachedRows(MOF_CURRENT_CSV, CURRENT_TTL_MS);
const loadAll = cachedRows(MOF_ALL_CSV, ALL_TTL_MS);

/** 現在値と前日。月初で当月分が 1 行以下のときだけ全期間の CSV で前月末を補う */
export async function getJgbQuote(): Promise<WorldQuote | null> {
    const current = await loadCurrent().catch(() => [] as JgbRow[]);
    if (current.length >= 2) return toJgbQuote(current);
    const all = await loadAll().catch(() => [] as JgbRow[]);
    return toJgbQuote(mergeRows(all, current));
}

/** 詳細チャート。全期間の CSV（前月末まで）に当月分を重ねる */
export async function getJgbHistory(range: HistoryRange): Promise<QuoteHistory | null> {
    const [all, current] = await Promise.all([loadAll(), loadCurrent().catch(() => [] as JgbRow[])]);
    return toJgbHistory(mergeRows(all, current), range);
}
