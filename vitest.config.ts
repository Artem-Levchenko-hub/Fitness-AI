import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/` → repo root. Явный alias (а не неявный tsconfck-резолв Vite) — иначе
  // свежесозданные файлы до прогрева кэша не резолвят `@/…` ("Cannot find
  // package"). Зеркалит tsconfig.compilerOptions.paths `@/*` → `./*`.
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "server/**/*.test.ts"],
  },
});
