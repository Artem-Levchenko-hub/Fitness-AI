import { defineConfig, devices } from "@playwright/test";

/**
 * H7.3 — регрессионный смоук-гейт. Минимальный набор критических потоков,
 * который ОБЯЗАН пройти зелёным перед деплоем каждого consolidation-слайса H7.
 *
 * Цель — внешний прод-билд, НЕ локальный dev-сервер: проект self-hosted, локальная
 * Docker-тест-БД сломана, поэтому единственный рабочий E2E-путь — живой прод
 * (fitnesss.online) с восстановленной сессией. Это тот же путь, что и
 * ручной протокол верификации (issue-session.mjs → /api/auth/restore). Поэтому
 * здесь нет `webServer` — мы НЕ поднимаем приложение, а ходим к уже задеплоенному.
 *
 * Аутентификация — проект `setup` (auth.setup.ts) восстанавливает сессию из
 * E2E_REFRESH_TOKEN и сохраняет storageState; смоук-проект его переиспользует.
 */

const baseURL = process.env.E2E_BASE_URL ?? "https://fitnesss.online";

export default defineConfig({
  testDir: "./e2e",
  // Один поток, без ретраев — гейт против живого прода: флапающий ретрай скрыл бы
  // реальную регрессию. forbidOnly в CI, чтобы случайный .only не сузил набор.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "smoke",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
