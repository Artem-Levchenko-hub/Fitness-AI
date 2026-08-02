import { defineConfig, devices } from "@playwright/test";

/**
 * H7.3 — регрессионный смоук-гейт. Минимальный набор критических потоков,
 * который ОБЯЗАН пройти зелёным перед деплоем каждого consolidation-слайса H7.
 *
 * По умолчанию public-smoke запускается против локального production build.
 * Authenticated/mutating smoke разрешён только при явных E2E_BASE_URL,
 * E2E_REFRESH_TOKEN и полном наборе одноразовых fixtures; production никогда не
 * является неявной целью теста.
 *
 * Аутентификация — проект `setup` (auth.setup.ts) восстанавливает сессию из
 * E2E_REFRESH_TOKEN и сохраняет storageState; смоук-проект его переиспользует.
 */

const externalBaseUrl = process.env.E2E_BASE_URL;
const baseURL = externalBaseUrl ?? "http://127.0.0.1:3000";
const localProductionResolve = process.env.E2E_LOCAL_PRODUCTION_RESOLVE === "1";

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
    // На production VPS публичный адрес может не поддерживать NAT loopback.
    // Оставляем URL/certificate/Host каноническими, но в явно включённом smoke
    // направляем Chromium напрямую в локальный nginx. Внешние CI и dev-запуски
    // этот override не получают.
    launchOptions: localProductionResolve
      ? {
          args: [
            "--host-resolver-rules=MAP fitnesss.online 127.0.0.1",
            "--disable-http2",
          ],
        }
      : undefined,
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
          ...process.env,
          SKIP_ENV_VALIDATION: "1",
          AUTH_SECRET:
            process.env.AUTH_SECRET ??
            "local-public-e2e-secret-is-not-used-outside-this-test-run",
        },
      },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "public-mobile",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "smoke",
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
