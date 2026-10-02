import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JGB10Y_SYMBOL, MOF_ALL_CSV, MOF_CURRENT_CSV, mergeRows, parseMofCsv, toJgbHistory, toJgbQuote } from '../lib/jgb';
import { MARKETS } from '../lib/world-markets';
import { detectRelatedMarkets } from '../lib/related-news';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';
const get = vi.mocked(axios.get);

/** 財務省の CSV と同じ形（1 行目・2 行目は日本語の見出し、10 年は 11 列目） */
export function mofCsv(rows: [string, string][], title = '国債金利情報'): string {
    const header = `${title},,,,,,,,,,,,,,,(単位 : %)\r\n基準日,1年,2年,3年,4年,5年,6年,7年,8年,9年,10年,15年,20年,25年,30年,40年\r\n`;
    return header + rows.map(([d, y10]) => `${d},1.6,1.9,2.0,2.2,2.4,2.5,2.6,2.8,2.9,${y10},3.6,3.9,4.1,4.1,4.1`).join('\r\n') + '\r\n';
}

describe('parseMofCsv', () => {
    it('和暦の日付を西暦にし、10 年の欄を読む。見出し・注記・「-」の行は捨てる', () => {
        const text = mofCsv([['R8.9.30', '3.057'], ['R8.10.1', '3.092'], ['S49.9.24', '-'], ['H30.1.4', '0.055']])
            + '※最新のcsvデータがダウンロードできない場合,,,\r\n,,,\r\n';
        expect(parseMofCsv(text)).toEqual([
            { date: '2018-01-04', y10: 0.055 },
            { date: '2026-09-30', y10: 3.057 },
            { date: '2026-10-01', y10: 3.092 },
        ]);
    });

    it('当月分がまだ無い（見出しだけ）なら空', () => {
        expect(parseMofCsv(mofCsv([]))).toEqual([]);
        expect(parseMofCsv('')).toEqual([]);
    });
});

describe('mergeRows / toJgbQuote / toJgbHistory', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({
        date: new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10),
        y10: 1 + i / 100,
    }));

    it('同じ日は新しく取った方を使い、日付順に並べる', () => {
        expect(mergeRows([{ date: '2026-09-30', y10: 1 }, { date: '2026-09-29', y10: 0.9 }], [{ date: '2026-09-30', y10: 2 }, { date: '2026-10-01', y10: 3 }]))
            .toEqual([{ date: '2026-09-29', y10: 0.9 }, { date: '2026-09-30', y10: 2 }, { date: '2026-10-01', y10: 3 }]);
    });

    it('最新と前日から騰落を出し、タイルの推移は直近 20 営業日。取引時間は持たない', () => {
        const q = toJgbQuote([{ date: '2026-09-30', y10: 3.057 }, { date: '2026-10-01', y10: 3.092 }])!;
        expect(q).toMatchObject({ symbol: JGB10Y_SYMBOL, price: 3.092, previousClose: 3.057, lastTradeAt: '2026-10-01T06:00:00.000Z' });
        expect(q.change).toBeCloseTo(0.035);
        expect(q.changePercent).toBeCloseTo((0.035 / 3.057) * 100);
        expect(q.sessionStart).toBeUndefined();
        expect(toJgbQuote(rows)!.history).toHaveLength(20);
        expect(toJgbQuote(rows.slice(0, 1))).toBeNull();
        // マイナス金利の時期でも騰落率の向きが変わらないよう絶対値で割る
        expect(toJgbQuote([{ date: '2019-08-01', y10: -0.2 }, { date: '2019-08-02', y10: -0.1 }])!.changePercent).toBeCloseTo(50);
        expect(toJgbQuote([{ date: '2016-01-01', y10: 0 }, { date: '2016-01-02', y10: 0.1 }])!.changePercent).toBe(0);
    });

    it('詳細チャートは 5 日 = 5 本、1 か月 = 22 本、1 年 = 245 本', () => {
        expect(toJgbHistory(rows, '5d')!.points).toHaveLength(5);
        expect(toJgbHistory(rows, '1mo')!.points).toHaveLength(22);
        const y = toJgbHistory(rows, '1y')!;
        expect(y.points).toHaveLength(245);
        expect(y).toMatchObject({ first: rows[55].y10, last: rows[299].y10, high: rows[299].y10, low: rows[55].y10 });
        expect(toJgbHistory(rows.slice(0, 1), '5d')).toBeNull();
        expect(toJgbHistory([{ date: 'a', y10: 0 }, { date: 'b', y10: 1 }], '5d')!.changePercent).toBe(0);
    });
});

describe('銘柄表と関連ニュース', () => {
    it('日本国債 10 年は財務省から取る銘柄として「為替・金利」に入っている', () => {
        expect(MARKETS.find(m => m.symbol === JGB10Y_SYMBOL)).toMatchObject({ region: 'fx', source: 'mof', suffix: '%' });
    });

    it('「長期金利」「10年債」は他国の名前が無い見出しだけ日本国債にする', () => {
        expect(detectRelatedMarkets('債券15時　長期金利、横ばいの3.095%')).toEqual(['JGB10Y']);
        expect(detectRelatedMarkets('新発10年債利回りが一時3.1%')).toEqual(['JGB10Y']);
        expect(detectRelatedMarkets('日本国債の入札、需要は底堅い')).toEqual(['JGB10Y']);
        expect(detectRelatedMarkets('米10年債利回り5.33％に上昇')).toEqual(['^TNX']);
        // 米国の話だが「米長期金利」とは書いていないので、どちらにも紐づけない
        expect(detectRelatedMarkets('米雇用統計、長期金利低下促すハードル高い')).toEqual([]);
        expect(detectRelatedMarkets('欧州国債早朝　ドイツ長期金利、低下')).toEqual([]);
    });
});

describe('jgb-cache', () => {
    async function load() {
        vi.resetModules();
        return import('../lib/jgb-cache');
    }
    const serve = (current: string | null, all: string | null) => get.mockImplementation(async (url: string) => {
        const body = url === MOF_CURRENT_CSV ? current : url === MOF_ALL_CSV ? all : null;
        if (body === null) throw new Error(`blocked: ${url}`);
        return { data: body };
    });

    beforeEach(() => {
        get.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('当月分に 2 行以上あれば、全期間の CSV は取らない', async () => {
        serve(mofCsv([['R8.10.1', '3.092'], ['R8.10.2', '3.104']]), null);
        const { getJgbQuote } = await load();
        expect(await getJgbQuote()).toMatchObject({ price: 3.104, previousClose: 3.092 });
        expect(get).toHaveBeenCalledTimes(1);
    });

    it('月初で当月分が 1 行以下なら、全期間の CSV で前月末を補う', async () => {
        serve(mofCsv([['R8.10.1', '3.092']]), mofCsv([['R8.9.29', '3.082'], ['R8.9.30', '3.057']]));
        const { getJgbQuote } = await load();
        expect(await getJgbQuote()).toMatchObject({ price: 3.092, previousClose: 3.057 });
    });

    it('当月分が取れなくても全期間の CSV で出す。どちらも取れなければ null', async () => {
        serve(null, mofCsv([['R8.9.29', '3.082'], ['R8.9.30', '3.057']]));
        expect(await (await load()).getJgbQuote()).toMatchObject({ price: 3.057 });
        serve(null, null);
        expect(await (await load()).getJgbQuote()).toBeNull();
    });

    it('1 時間はキャッシュし、切れたあと取れなければ古い値を使う', async () => {
        vi.useFakeTimers({ now: new Date('2026-10-02T00:00:00Z'), toFake: ['Date'] });
        serve(mofCsv([['R8.10.1', '3.092'], ['R8.10.2', '3.104']]), null);
        const { getJgbQuote } = await load();
        await getJgbQuote();
        await getJgbQuote();
        expect(get).toHaveBeenCalledTimes(1);
        vi.setSystemTime(new Date('2026-10-02T01:00:01Z'));
        serve(null, null);
        expect(await getJgbQuote()).toMatchObject({ price: 3.104 });
        expect(console.error).toHaveBeenCalled();
    });

    it('詳細チャートは全期間に当月分を重ねて作る', async () => {
        serve(mofCsv([['R8.10.1', '3.092']]), mofCsv([['R8.9.25', '3.071'], ['R8.9.28', '3.082'], ['R8.9.29', '3.082'], ['R8.9.30', '3.057']]));
        const { getJgbHistory } = await load();
        const h = await getJgbHistory('5d');
        expect(h!.points.map(p => p.v)).toEqual([3.071, 3.082, 3.082, 3.057, 3.092]);
    });

    it('全期間の CSV が取れなければ詳細チャートは失敗にする', async () => {
        serve(mofCsv([['R8.10.1', '3.092']]), null);
        const { getJgbHistory } = await load();
        await expect(getJgbHistory('1y')).rejects.toThrow();
    });
});
