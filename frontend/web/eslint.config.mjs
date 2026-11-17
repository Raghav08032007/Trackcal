import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Same rule families the previous Next.js preset applied: recommended JS + TypeScript, and the two React hooks rules.
export default defineConfig([
  globalIgnores([".next/**", "dist/**", "public/pose/**", "public/*.js", "runtime/**"]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn" },
  },
  { files: ["**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
]);
