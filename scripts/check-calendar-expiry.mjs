// 手動の経済指標予定表（lib/economic-calendar.ts）が切れかけていないかを見る。
// BLS（米雇用統計・CPI）は自動取得できず手動の予定表だけが頼りなので、切れると画面から消える。
// 使い方: node --experimental-strip-types scripts/check-calendar-expiry.mjs [残り日数のしきい値=45]
import { ECONOMIC_EVENTS, toJstDate } from '../lib/economic-calendar.ts';

const thresholdDays = Number(process.argv[2] ?? 45);
const now = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

// fomc / ecb / boj は公式ページから取れないときの予備なので警告だけにする
const REQUIRED = new Set(['bls']);

let failed = false;
const sources = [...new Set(ECONOMIC_EVENTS.map(e => e.source))];
for (const source of sources) {
    const last = Math.max(...ECONOMIC_EVENTS.filter(e => e.source === source).map(e => toJstDate(e.date, e.time).getTime()));
    const daysLeft = Math.floor((last - now) / DAY_MS);
    const lastDate = new Date(last).toISOString().slice(0, 10);
    const line = `${source}: 最後の予定 ${lastDate}（残り ${daysLeft} 日）`;
    if (daysLeft >= thresholdDays) {
        console.log(`ok   ${line}`);
    } else if (REQUIRED.has(source)) {
        console.log(`::error file=lib/economic-calendar.ts::${line}。ECONOMIC_EVENTS に次の予定を追加してください`);
        failed = true;
    } else {
        console.log(`::warning file=lib/economic-calendar.ts::${line}（公式ページから取れないときの予備）`);
    }
}
process.exit(failed ? 1 : 0);
