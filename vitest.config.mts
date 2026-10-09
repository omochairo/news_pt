import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // tsconfig の paths（@/*）と同じ。API ルートやコンポーネントは @/lib/... で import している
    resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
    // JSX を React 17+ の自動ランタイムで変換する（コンポーネントのテスト用）
    // （vitest 5 / Vite 8 から変換は esbuild でなく Oxc）
    oxc: { jsx: { runtime: 'automatic' } },
    test: {
        // 既定は node。画面のテストはファイル先頭の `// @vitest-environment jsdom` で切り替える
        environment: 'node',
        coverage: {
            provider: 'v8',
            include: ['lib/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}'],
            reporter: ['text-summary', 'text', 'html'],
            // 下回ったら CI を落とす（テストの無い変更でカバレッジが下がり続けないように）
            thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
        },
    },
});
