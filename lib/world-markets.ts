/**
 * 世界の市場グリッド（/markets）の銘柄定義と、Yahoo Finance spark API の応答の整形。
 * サーバー・クライアントの両方から読むので、外部通信やサーバー専用の依存を置かない。
 */

export type MarketRegion = 'japan' | 'us' | 'fx' | 'commodities' | 'asia' | 'europe' | 'americas';

export interface MarketDef {
    symbol: string;      // Yahoo Finance のシンボル（source があるときはこのアプリ内の識別子）
    name: string;
    note?: string;       // 代替銘柄であることなどの補足
    region: MarketRegion;
    decimals?: number;   // 価格の小数桁（既定 2）
    suffix?: string;
    h24?: boolean;       // ほぼ 24 時間取引される（24 時間ビューの対象）
    source?: 'mof';      // Yahoo 以外から取る（mof = 財務省の国債金利 CSV。日次）
}

export const REGIONS: { id: MarketRegion; label: string }[] = [
    { id: 'japan', label: '日本' },
    { id: 'us', label: '米国' },
    { id: 'fx', label: '為替・金利' },
    { id: 'commodities', label: '商品・暗号資産' },
    { id: 'asia', label: 'アジア・オセアニア' },
    { id: 'europe', label: '欧州・中東・アフリカ' },
    { id: 'americas', label: '米州' },
];

export const MARKETS: MarketDef[] = [
    { symbol: '^N225', name: '日経平均', region: 'japan' },
    { symbol: 'NIY=F', name: '日経先物', note: 'CME 円建て', region: 'japan', decimals: 0, h24: true },
    { symbol: '1306.T', name: 'TOPIX', note: '連動 ETF 1306', region: 'japan', decimals: 1 },
    { symbol: '2516.T', name: 'グロース250', note: '連動 ETF 2516', region: 'japan', decimals: 1 },

    { symbol: '^DJI', name: 'ダウ平均', region: 'us' },
    { symbol: 'YM=F', name: 'ダウ先物', region: 'us', decimals: 0, h24: true },
    { symbol: '^IXIC', name: 'ナスダック', region: 'us' },
    { symbol: 'NQ=F', name: 'ナスダック100先物', region: 'us', h24: true },
    { symbol: '^GSPC', name: 'S&P500', region: 'us' },
    { symbol: 'ES=F', name: 'S&P500先物', region: 'us', h24: true },
    { symbol: '^SOX', name: '半導体指数 SOX', region: 'us' },
    { symbol: '^RUT', name: 'ラッセル2000', region: 'us' },
    { symbol: '^NYFANG', name: 'FANG+', region: 'us' },
    { symbol: '^VIX', name: '恐怖指数 VIX', region: 'us' },
    { symbol: 'ACWI', name: '全世界株式', note: 'ETF ACWI', region: 'us' },

    { symbol: 'JPY=X', name: 'ドル円', region: 'fx', decimals: 3, h24: true },
    { symbol: 'EURJPY=X', name: 'ユーロ円', region: 'fx', decimals: 3, h24: true },
    { symbol: 'GBPJPY=X', name: 'ポンド円', region: 'fx', decimals: 3, h24: true },
    { symbol: 'AUDJPY=X', name: '豪ドル円', region: 'fx', decimals: 3, h24: true },
    { symbol: 'EURUSD=X', name: 'ユーロドル', region: 'fx', decimals: 4, h24: true },
    { symbol: '^TNX', name: '米国債10年 利回り', region: 'fx', decimals: 3, suffix: '%' },
    { symbol: 'JGB10Y', name: '日本国債10年 利回り', note: '財務省・日次', region: 'fx', decimals: 3, suffix: '%', source: 'mof' },

    { symbol: 'GC=F', name: '金先物', region: 'commodities', decimals: 1, h24: true },
    { symbol: 'SI=F', name: '銀先物', region: 'commodities', decimals: 3, h24: true },
    { symbol: 'HG=F', name: '銅先物', region: 'commodities', decimals: 3, h24: true },
    { symbol: 'CL=F', name: '原油 WTI', region: 'commodities', h24: true },
    { symbol: 'NG=F', name: '天然ガス', region: 'commodities', decimals: 3, h24: true },
    { symbol: 'BTC-JPY', name: 'ビットコイン', note: '円', region: 'commodities', decimals: 0, h24: true },
    { symbol: 'ETH-JPY', name: 'イーサリアム', note: '円', region: 'commodities', decimals: 0, h24: true },
    { symbol: 'XRP-JPY', name: 'XRP', note: '円', region: 'commodities', h24: true },
    { symbol: 'SOL-JPY', name: 'ソラナ', note: '円', region: 'commodities', decimals: 0, h24: true },

    { symbol: '000001.SS', name: '上海総合', region: 'asia' },
    { symbol: '^HSI', name: '香港 ハンセン', region: 'asia' },
    { symbol: '^KS11', name: '韓国 KOSPI', region: 'asia' },
    { symbol: '^TWII', name: '台湾 加権', region: 'asia' },
    { symbol: '^NSEI', name: 'インド Nifty50', region: 'asia' },
    { symbol: '^STI', name: 'シンガポール STI', region: 'asia' },
    { symbol: '^KLSE', name: 'マレーシア KLCI', region: 'asia' },
    { symbol: '^SET.BK', name: 'タイ SET', region: 'asia' },
    { symbol: '^JKSE', name: 'インドネシア JKSE', region: 'asia' },
    { symbol: '^VNINDEX.VN', name: 'ベトナム VN指数', region: 'asia' },
    { symbol: '^AORD', name: 'オーストラリア AORD', region: 'asia' },
    { symbol: '^NZ50', name: 'ニュージーランド NZ50', region: 'asia' },

    { symbol: '^FTSE', name: 'イギリス FTSE100', region: 'europe' },
    { symbol: '^GDAXI', name: 'ドイツ DAX', region: 'europe' },
    { symbol: '^FCHI', name: 'フランス CAC40', region: 'europe' },
    { symbol: 'FTSEMIB.MI', name: 'イタリア MIB', region: 'europe' },
    { symbol: '^SSMI', name: 'スイス SMI', region: 'europe' },
    { symbol: '^STOXX50E', name: 'ユーロ・ストックス50', region: 'europe' },
    { symbol: 'XU100.IS', name: 'トルコ BIST100', region: 'europe' },
    { symbol: 'TA35.TA', name: 'イスラエル TA35', region: 'europe' },
    { symbol: '^J203.JO', name: '南アフリカ 全株', region: 'europe' },
    { symbol: '^TASI.SR', name: 'サウジ TASI', region: 'europe' },

    { symbol: '^GSPTSE', name: 'カナダ S&P/TSX', region: 'americas' },
    { symbol: '^MXX', name: 'メキシコ IPC', region: 'americas' },
    { symbol: '^BVSP', name: 'ブラジル ボベスパ', region: 'americas' },
];

export interface WorldQuote {
    symbol: string;
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    history: number[];      // 当日の終値（古い順・間引き済み）
    lastTradeAt?: string;   // 最後の足の時刻（ISO）
    sessionStart?: string;  // 直近の取引日の取引時間（ISO）。先物・為替・暗号資産はほぼ 24 時間
    sessionEnd?: string;
}

export type MarketStatus = 'open' | 'closed';

// 取引時間内でも、最後の足からこれ以上たっていたら止まっているとみなす（昼休み・休場・取得の遅れ）。
// Yahoo の値は 15 分前後遅れるので、それより長めにとる
const STALE_AFTER_MS = 30 * 60 * 1000;

/** 取引中か。直近の取引日の取引時間内で、かつ最近まで値が付いていれば取引中 */
export function getMarketStatus(quote: Pick<WorldQuote, 'lastTradeAt' | 'sessionStart' | 'sessionEnd'>, now: Date): MarketStatus {
    if (!quote.sessionStart || !quote.sessionEnd || !quote.lastTradeAt) return 'closed';
    const t = now.getTime();
    const inSession = t >= new Date(quote.sessionStart).getTime() && t <= new Date(quote.sessionEnd).getTime();
    const fresh = t - new Date(quote.lastTradeAt).getTime() <= STALE_AFTER_MS;
    return inSession && fresh ? 'open' : 'closed';
}

export const HISTORY_MAX_POINTS = 60;

function downsample(values: number[], max: number): number[] {
    if (values.length <= max) return values;
    const step = (values.length - 1) / (max - 1);
    return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

interface SparkEntry {
    timestamp?: unknown[];
    close?: unknown[];
    previousClose?: unknown;
    chartPreviousClose?: unknown;
    fulldayPrice?: unknown;
    start?: unknown;
    end?: unknown;
}

const toIso = (sec: unknown) => (isNum(sec) ? new Date(sec * 1000).toISOString() : undefined);

/** spark API の応答（{ [symbol]: {...} }）を WorldQuote に整形する。値が欠けた銘柄は含めない */
export function parseSparkResponse(body: unknown): WorldQuote[] {
    if (!body || typeof body !== 'object') return [];
    const quotes: WorldQuote[] = [];

    for (const [symbol, raw] of Object.entries(body as Record<string, SparkEntry>)) {
        if (!raw || typeof raw !== 'object') continue;
        const closes = Array.isArray(raw.close) ? raw.close : [];
        const stamps = Array.isArray(raw.timestamp) ? raw.timestamp : [];

        const points: number[] = [];
        let lastStamp: number | undefined;
        closes.forEach((c, i) => {
            if (!isNum(c)) return;
            points.push(c);
            if (isNum(stamps[i])) lastStamp = stamps[i] as number;
        });

        const previousClose = isNum(raw.previousClose) ? raw.previousClose : isNum(raw.chartPreviousClose) ? raw.chartPreviousClose : undefined;
        // 取引日が切り替わって当日の足がまだ無い（取引開始前）ときは close が null になる。
        // その間は直前の取引日の終値（fulldayPrice）で出し、チャートは空にする
        const price = points.at(-1) ?? (isNum(raw.fulldayPrice) ? raw.fulldayPrice : undefined);
        if (price === undefined || previousClose === undefined || previousClose === 0) continue;
        // Yahoo が前日終値を壊れた値で返すことがある（上海総合で 3813 に対して 0.0002）。
        // 1 日で半分や倍になることはまず無いので、その範囲を外れたら取れなかったものとして扱う
        const ratio = price / previousClose;
        if (!(ratio > 0.5 && ratio < 2)) continue;

        const change = price - previousClose;
        quotes.push({
            symbol,
            price,
            previousClose,
            change,
            changePercent: (change / previousClose) * 100,
            history: downsample(points, HISTORY_MAX_POINTS),
            lastTradeAt: toIso(lastStamp),
            sessionStart: toIso(raw.start),
            sessionEnd: toIso(raw.end),
        });
    }
    return quotes;
}

export function formatPrice(value: number, def: Pick<MarketDef, 'decimals' | 'suffix'>): string {
    const decimals = def.decimals ?? 2;
    const text = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return def.suffix ? `${text}${def.suffix}` : text;
}

export function formatChange(value: number, decimals: number): string {
    const text = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return `${value > 0 ? '+' : value < 0 ? '-' : '±'}${text}`;
}

export interface Quote24h {
    symbol: string;
    price: number;
    base: number;           // 24 時間前の値
    change: number;
    changePercent: number;
    high: number;
    low: number;
    rangePercent: number;   // 24 時間の高値と安値の差（base 比）
    history: number[];      // 24 時間分の終値（古い順・間引き済み）
    from: string;           // 窓の始まり・終わり（ISO）
    to: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 複数日の spark 応答から、最後の足までの 24 時間の値動きを出す。
 * 週末で止まっている先物も「止まる直前の 24 時間」になるよう、窓の終わりは現在時刻ではなく最後の足にする。
 */
export function parse24h(body: unknown): Quote24h[] {
    if (!body || typeof body !== 'object') return [];
    const quotes: Quote24h[] = [];

    for (const [symbol, raw] of Object.entries(body as Record<string, SparkEntry>)) {
        if (!raw || typeof raw !== 'object') continue;
        const closes = Array.isArray(raw.close) ? raw.close : [];
        const stamps = Array.isArray(raw.timestamp) ? raw.timestamp : [];

        const bars: { t: number; v: number }[] = [];
        closes.forEach((c, i) => {
            if (isNum(c) && isNum(stamps[i])) bars.push({ t: (stamps[i] as number) * 1000, v: c });
        });
        if (bars.length < 2) continue;

        const last = bars[bars.length - 1];
        const from = last.t - DAY_MS;
        // 24 時間前ちょうどの足が無いこともあるので、それ以前で最も新しい足を起点にする
        let startIdx = 0;
        for (let i = 0; i < bars.length; i++) {
            if (bars[i].t <= from) startIdx = i;
            else break;
        }
        const windowBars = bars.slice(startIdx);
        if (windowBars.length < 2) continue;

        const values = windowBars.map(b => b.v);
        const base = values[0];
        if (base === 0) continue;
        const high = Math.max(...values);
        const low = Math.min(...values);
        const change = last.v - base;

        quotes.push({
            symbol,
            price: last.v,
            base,
            change,
            changePercent: (change / base) * 100,
            high,
            low,
            rangePercent: ((high - low) / base) * 100,
            history: downsample(values, HISTORY_MAX_POINTS),
            from: new Date(windowBars[0].t).toISOString(),
            to: new Date(last.t).toISOString(),
        });
    }
    return quotes;
}

/** 詳細チャートの期間。interval は Yahoo の足の長さ */
export const HISTORY_RANGES = [
    { id: '5d', label: '5日', interval: '30m' },
    { id: '1mo', label: '1か月', interval: '1h' },
    { id: '1y', label: '1年', interval: '1d' },
] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number]['id'];

export interface QuoteHistory {
    symbol: string;
    range: HistoryRange;
    points: { t: string; v: number }[];   // 古い順・間引き済み（t は ISO）
    first: number;
    last: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
}

export const DETAIL_MAX_POINTS = 160;

/** 1 銘柄分の spark 応答から、期間の推移と騰落・高安を出す。足が 2 本未満なら null */
export function parseHistory(body: unknown, symbol: string, range: HistoryRange): QuoteHistory | null {
    const raw = body && typeof body === 'object' ? (body as Record<string, SparkEntry>)[symbol] : undefined;
    if (!raw || typeof raw !== 'object') return null;
    const closes = Array.isArray(raw.close) ? raw.close : [];
    const stamps = Array.isArray(raw.timestamp) ? raw.timestamp : [];

    const bars: { t: number; v: number }[] = [];
    closes.forEach((c, i) => {
        if (isNum(c) && isNum(stamps[i])) bars.push({ t: stamps[i] as number, v: c });
    });
    if (bars.length < 2) return null;

    const first = bars[0].v;
    const last = bars[bars.length - 1].v;
    if (first === 0) return null;
    const values = bars.map(b => b.v);
    // 間引いても最後の足（現在値）は必ず残す
    const idx = downsample(bars.map((_, i) => i), DETAIL_MAX_POINTS);
    idx[idx.length - 1] = bars.length - 1;

    return {
        symbol,
        range,
        points: idx.map(i => ({ t: new Date(bars[i].t * 1000).toISOString(), v: bars[i].v })),
        first,
        last,
        change: last - first,
        changePercent: ((last - first) / first) * 100,
        high: Math.max(...values),
        low: Math.min(...values),
    };
}
