import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';

const get = vi.mocked(axios.get);

const CSV = [
    '基準日,1年,2年,3年,4年,5年,6年,7年,8年,9年,10年',
    'R8.10.30,1,1,1,1,1,1,1,1,1,2.100',
    'R8.10.31,1,1,1,1,1,1,1,1,1,2.150',
].join('\n');
const HTML_ERROR_PAGE = '<html><body>メンテナンス中</body></html>';

beforeEach(() => {
    vi.resetModules();
    get.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('jgb-cache: CSV として読めない 200 応答', () => {
    it('取得済みの行があるとき、HTML などの空解析結果で上書きしない', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-11-03T00:00:00Z'));
        const { getJgbQuote } = await import('../lib/jgb-cache');

        get.mockResolvedValueOnce({ data: CSV });
        expect((await getJgbQuote())?.price).toBe(2.15);

        // 1 時間後（キャッシュ切れ）にメンテナンスページが 200 で返る
        vi.setSystemTime(new Date('2026-11-03T01:00:01Z'));
        get.mockResolvedValue({ data: HTML_ERROR_PAGE });
        expect((await getJgbQuote())?.price).toBe(2.15);
    });
});
