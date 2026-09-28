# Vantage Point — Global Market Intelligence

金融ニュースをまとめて読むためのダッシュボード（Next.js App Router / PWA）。Netlify で配信している。

## 構成

| 場所 | 役割 |
|---|---|
| `app/api/news` | 日経・みんかぶFX・暗号資産・Bloomberg・Reuters・CNN の記事を RSS / Google News RSS から取得（5 分キャッシュ） |
| `app/api/market` | 為替・株価指数・BTC・原油の相場（Yahoo Finance、失敗時は Google Finance。1 分キャッシュ） |
| `app/api/calendar` | FOMC・ECB・日銀の会合日程を公式ページから取得（12 時間キャッシュ）。米雇用統計・CPI は手動の予定表 |
| `lib/` | 取得・分類（カテゴリ / 重要度 / 有料記事判定）・ブックマークと既読・履歴（localStorage） |
| `components/` | 画面（通常 / ターミナル / 2 画面表示） |
| `scripts/` | 手元で外部フィードを調べるための使い捨てスクリプト（アプリからは読み込まない。lint 対象外） |

キャッシュはサーバーのメモリ上に持つ。取得元への連打で BAN されないためのもので、`/api/news?refresh=true` もキャッシュが 1 分以上古いときしか効かない。

## 開発

```bash
npm ci
npm run dev          # http://localhost:3000
npm run lint
npm run typecheck
npm test             # vitest
npm run build
```

CI（`.github/workflows/ci.yml`）は PR と main への push で lint → typecheck → test → build を実行する。依存の更新は Dependabot が PR を出す。

## 定期メンテナンス

**米雇用統計・CPI の日程は `lib/economic-calendar.ts` の `ECONOMIC_EVENTS` に手で追加する**（BLS は機械的な取得を拒否するため）。出典はファイル冒頭のコメントにある。

切れる前に気づけるよう、`.github/workflows/calendar-expiry.yml` が毎週月曜に残り日数を確認し、45 日を切ると失敗する。手元では次で確認できる。

```bash
npm run check:calendar
```
