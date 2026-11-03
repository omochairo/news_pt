import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';

const get = vi.mocked(axios.get);

const CSV = [
    '基準日,1年,2年,3年,4年,5年,6年,7年,8年,9年,10年',
    'R8.10.30,1,1,1,1,1,1,1,1,1,2.100',
    'R8.10.31,1,1,1,1,1,1,1,1,1,2.150',
].join('\n');

beforeEach(() => {
    vi.resetModules();
    get.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('jgb-cache: 財務省が落ちているとき', () => {
    it('古い値を返す間は、毎回取りに行かず 1 分あけて取り直す', async () => {
        const { getJgbQuote } = await import('../lib/jgb-cache');
        get.mockResolvedValueOnce({ data: CSV });
        expect((await getJgbQuote())?.price).toBe(2.15);
        const afterFirst = get.mock.calls.length;

        // キャッシュ切れ（1 時間後）から障害
        vi.setSystemTime(new Date('2026-11-03T01:00:01Z'));
        get.mockRejectedValue(new Error('timeout'));
        expect((await getJgbQuote())?.price).toBe(2.15);
        const afterFail = get.mock.calls.length;
        expect(afterFail).toBeGreaterThan(afterFirst);

        // 30 秒後・50 秒後の要求は財務省に取りに行かない
        for (const sec of [30, 50]) {
            vi.setSystemTime(new Date(Date.parse('2026-11-03T01:00:01Z') + sec * 1000));
            expect((await getJgbQuote())?.price).toBe(2.15);
        }
        expect(get.mock.calls.length).toBe(afterFail);

        // 1 分を過ぎたら取り直す
        vi.setSystemTime(new Date(Date.parse('2026-11-03T01:00:01Z') + 61 * 1000));
        await getJgbQuote();
        expect(get.mock.calls.length).toBeGreaterThan(afterFail);
    });

    it('最初の取得が HTML のエラーページ（0 行）でも、1 分後には取り直して復旧する', async () => {
        const { getJgbQuote } = await import('../lib/jgb-cache');
        get.mockResolvedValue({ data: '<html>メンテナンス中</html>' });
        expect(await getJgbQuote()).toBeNull();

        vi.setSystemTime(new Date('2026-11-03T00:01:01Z'));
        get.mockResolvedValue({ data: CSV });
        expect((await getJgbQuote())?.price).toBe(2.15);
    });

    it('取得済みの行があるとき 0 行が返っても、1 分後には取り直す（最長 6 時間待たない）', async () => {
        const { getJgbQuote } = await import('../lib/jgb-cache');
        get.mockResolvedValueOnce({ data: CSV });
        expect((await getJgbQuote())?.price).toBe(2.15);

        vi.setSystemTime(new Date('2026-11-03T01:00:01Z'));
        get.mockResolvedValue({ data: '<html>メンテナンス中</html>' });
        expect((await getJgbQuote())?.price).toBe(2.15);

        // 1 分後に復旧した CSV（新しい基準日）を拾う
        vi.setSystemTime(new Date('2026-11-03T01:01:10Z'));
        get.mockResolvedValue({ data: `${CSV}\nR8.11.01,1,1,1,1,1,1,1,1,1,2.200` });
        expect((await getJgbQuote())?.price).toBe(2.2);
    });
});
