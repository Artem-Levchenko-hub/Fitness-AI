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
    // Rescue snapshots — не часть проекта, не линтуем.
    ".claude/**",
    // Скомпилированный Emscripten runtime Draco (vendor asset, не наш JS).
    "public/draco/*.js",
  ]),
]);

export default eslintConfig;
