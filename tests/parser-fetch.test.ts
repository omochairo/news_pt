import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => ({ default: { get: vi.fn() } }));
import axios from 'axios';
import {
    fetchBloombergNews,
    fetchBOJNews,
    fetchCNNNews,
    fetchDiamondNews,
    fetchKabutanNews,
    fetchToyoKeizaiNews,
    fetchTradersWebNews,
    fetchZaiFXNews,
    fetchCryptoNews,
    fetchMinkabuFXNews,
    fetchNikkeiNews,
    fetchReutersNews,
} from '../lib/parser';

const get = vi.mocked(axios.get);

function rss(items: { title: string; link: string; date?: string }[]): string {
    return `<?xml version="1.0"?><rss><channel>${items.map(i =>
        `<item><title>${i.title}</title><link>${i.link}</link>${i.date ? `<pubDate>${i.date}</pubDate>` : ''}</item>`,
    ).join('')}</channel></rss>`;
}

/** URL ごとの応答を決める。関数が null を返したら失敗させる */
function respond(handler: (url: string) => string | null) {
    get.mockImplementation(async (url: string) => {
        const body = handler(url);
        if (body === null) throw new Error(`blocked: ${url}`);
        return { data: body };
    });
}

const many = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ title: `${prefix} 記事${i}`, link: `https://example.com/${prefix}/${i}`, date: 'Wed, 01 Oct 2026 01:00:00 GMT' }));

beforeEach(() => {
    get.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('Google News 経由の媒体', () => {
    it('Reuters: 見出し末尾の媒体名を落とし、30 件までにする', async () => {
        respond(() => rss([
            { title: '日銀が金融政策決定会合 - ロイター', link: 'https://jp.reuters.com/a' },
            { title: '東京外為市場の円相場 | ロイター - Reuters', link: 'https://jp.reuters.com/b' },
            ...many('r', 40),
        ]));
        const items = await fetchReutersNews();
        expect(items).toHaveLength(30);
        expect(items[0]).toMatchObject({ title: '日銀が金融政策決定会合', source: 'Reuters' });
        expect(items[1].title).toBe('東京外為市場の円相場');
        expect(get.mock.calls[0][0]).toContain('news.google.com/rss/search?q=');
    });

    it('1 回目が 0 件なら 2 つ目のクエリで取り直す', async () => {
        let call = 0;
        respond(() => (call++ === 0 ? rss([]) : rss([{ title: 'ブルームバーグの記事 - Bloomberg', link: 'https://bloomberg.co.jp/a' }])));
        expect((await fetchBloombergNews()).map(i => i.title)).toEqual(['ブルームバーグの記事']);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it('取得に失敗したら空（例外を外へ投げない）', async () => {
        respond(() => null);
        await expect(fetchCNNNews()).resolves.toEqual([]);
        expect(console.error).toHaveBeenCalled();
    });

    it('CNN: 1 回目で取れればそれを返す', async () => {
        respond(() => rss([{ title: '米大統領が演説した - CNN.co.jp', link: 'https://www.cnn.co.jp/a' }]));
        expect((await fetchCNNNews()).map(i => i.title)).toEqual(['米大統領が演説した']);
        expect(get).toHaveBeenCalledTimes(1);
    });
});

describe('RSS を直接取る媒体', () => {
    it('日経: 複数の RDF を並列に取り、URL・見出しの重複を除いて並び順を保つ', async () => {
        respond(url => {
            if (url.endsWith('markets.rdf')) return rss([{ title: '日経の記事そのA', link: 'https://www.nikkei.com/a' }, { title: '日経の記事そのB', link: 'https://www.nikkei.com/b' }]);
            if (url.endsWith('economy.rdf')) return rss([{ title: '日経の記事そのB', link: 'https://www.nikkei.com/b2' }, { title: '日経の記事そのC', link: 'https://www.nikkei.com/c' }]);
            if (url.endsWith('news.rdf')) return null; // 1 本落ちても残りで返す
            return rss([{ title: '日経の記事そのD', link: 'https://www.nikkei.com/a' }]);
        });
        const items = await fetchNikkeiNews();
        expect(items.map(i => i.title)).toEqual(['日経の記事そのA', '日経の記事そのB', '日経の記事そのC']);
        expect(items.every(i => i.source === 'Nikkei')).toBe(true);
    });

    it('日経・みんかぶ・暗号資産: RSS が全滅したら Google News に切り替える', async () => {
        respond(url => (url.includes('news.google.com') ? rss([{ title: '代替の記事を取得 - 日本経済新聞', link: 'https://www.nikkei.com/x' }]) : null));
        expect((await fetchNikkeiNews()).map(i => i.title)).toEqual(['代替の記事を取得']);
        expect((await fetchMinkabuFXNews()).map(i => i.source)).toEqual(['MinkabuFX']);
        expect((await fetchCryptoNews()).map(i => i.source)).toEqual(['Crypto']);
    });

    it('みんかぶ 30 件・暗号資産 30 件で打ち切る', async () => {
        respond(url => rss(many(url, 20)));
        expect(await fetchMinkabuFXNews()).toHaveLength(30);
        expect(await fetchCryptoNews()).toHaveLength(30);
    });

    it('http(s) 以外の URL・空の見出しは捨てる', async () => {
        respond(() => rss([
            { title: '通る記事の見出し', link: 'https://coinpost.jp/a' },
            { title: '危ないリンクの記事', link: 'javascript:alert(1)' },
            { title: '', link: 'https://coinpost.jp/b' },
        ]));
        expect((await fetchCryptoNews()).map(i => i.title)).toEqual(['通る記事の見出し']);
    });
});

describe('追加した媒体', () => {
    it('日銀: 公式 RSS を直接取り、採用・説明会・なりすまし注意などの事務連絡を除く', async () => {
        respond(() => rss([
            { title: '金融政策決定会合における主な意見（9月17、18日開催分）', link: 'https://www.boj.or.jp/a' },
            { title: '日本銀行に関する学生向けの説明会、職員との座談会への参加募集について', link: 'https://www.boj.or.jp/b' },
            { title: '日本銀行の関与を装った不審な連絡にご注意ください', link: 'https://www.boj.or.jp/c' },
            { title: '【挨拶】植田総裁（全国証券大会）', link: 'https://www.boj.or.jp/d' },
        ]));
        const items = await fetchBOJNews();
        expect(items.map(i => i.title)).toEqual(['金融政策決定会合における主な意見（9月17、18日開催分）', '【挨拶】植田総裁（全国証券大会）']);
        expect(items[0].source).toBe('BOJ');
        expect(get.mock.calls[0][0]).toBe('https://www.boj.or.jp/rss/whatsnew.xml');
    });

    it('株探・トレーダーズ・ウェブ・ザイFX！: Google News の site: 検索で取り、見出し末尾の分類を落とす', async () => {
        respond(url => {
            if (url.includes('kabutan')) return rss([{ title: '話題株ピックアップ【夕刊】（3）：ニデック - 株探', link: 'https://kabutan.jp/a' }]);
            if (url.includes('traders')) return rss([{ title: '今日の株価材料－ファストリが大幅増配 | 個別記事 | ニュース - トレーダーズ・ウェブ', link: 'https://www.traders.co.jp/a' }]);
            return rss([{ title: '10月8日のNY為替・原油概況｜FX・為替ニュース - ザイFX！', link: 'https://zai.diamond.jp/a' }]);
        });
        expect((await fetchKabutanNews())[0]).toMatchObject({ title: '話題株ピックアップ【夕刊】（3）：ニデック', source: 'Kabutan' });
        expect((await fetchTradersWebNews())[0]).toMatchObject({ title: '今日の株価材料－ファストリが大幅増配', source: 'TradersWeb' });
        expect((await fetchZaiFXNews())[0]).toMatchObject({ title: '10月8日のNY為替・原油概況', source: 'ZaiFX' });
        expect(decodeURIComponent(get.mock.calls[0][0])).toContain('site:kabutan.jp');
    });

    it('東洋経済: 配信のカテゴリで経済・ビジネスに絞り、改行入りの見出しと末尾の分類を整える', async () => {
        const item = (title: string, category: string, n: number) =>
            `<item><title><![CDATA[\n  ${title} | ${category} | 東洋経済オンライン\n]]></title><link>https://toyokeizai.net/articles/-/${n}</link><category>${category}</category></item>`;
        respond(() => `<?xml version="1.0"?><rss><channel>${[
            item('中部鋼鈑が今期業績を下方修正した事情', '政治・経済・投資', 1),
            item('育休中の妻だけが貧しくなった', 'ライフ', 2),
            item('｢5年先のスズキ車｣の姿', 'ビジネス', 3),
            item('定番のボウリング大会はなぜなくならないのか', 'キャリア・教育', 4),
        ].join('')}</channel></rss>`);
        const items = await fetchToyoKeizaiNews();
        expect(items.map(i => i.title)).toEqual(['中部鋼鈑が今期業績を下方修正した事情', '｢5年先のスズキ車｣の姿']);
        expect(items[0].source).toBe('ToyoKeizai');
    });

    it('ダイヤモンド: 市況の語で絞った Google News 検索で取り、ザイFX！を除く', async () => {
        respond(() => rss([{ title: '絶好調ハイテク株もむしばむ金利上昇 - ダイヤモンド・オンライン', link: 'https://diamond.jp/a' }]));
        expect((await fetchDiamondNews())[0]).toMatchObject({ title: '絶好調ハイテク株もむしばむ金利上昇', source: 'Diamond' });
        const query = decodeURIComponent(get.mock.calls[0][0]);
        expect(query).toContain('site:diamond.jp -site:zai.diamond.jp');
        expect(query).toContain('金利');
    });
});
