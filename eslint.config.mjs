import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 手元の調査用スクリプト（アプリ本体からは読み込まない）
    "scripts/**",
    "test-gf.js",
    // npm run test:coverage が出す HTML レポート
    "coverage/**",
  ]),
]);

export default eslintConfig;
