import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { REFRESH_COOKIE_NAME } from "@/lib/auth/config";

/**
 * Восстанавливает прод-сессию из refresh-токена и сохраняет storageState для
 * смоук-проекта. Токен выпускается на проде:
 *   ssh kanavto-vps "bash -lc 'cd /opt/fitness-saas && \
 *     node --env-file=.env.production scripts/issue-session.mjs'"
 * и передаётся как E2E_REFRESH_TOKEN. Без токена authenticated gate обязан
 * падать: зелёный skip больше не считается проверкой релиза.
 */

const authFile = path.join(__dirname, ".auth", "user.json");
const token = process.env.E2E_REFRESH_TOKEN;
const baseUrl = process.env.E2E_BASE_URL;

setup("restore prod session", async ({ page }) => {
  if (!token || !baseUrl) {
    throw new Error(
      "E2E_BASE_URL и E2E_REFRESH_TOKEN обязательны — authenticated smoke разрешён только для явно указанного окружения",
    );
  }

  const target = new URL(baseUrl);
  await page.context().addCookies([
    {
      name: REFRESH_COOKIE_NAME,
      value: token,
      url: target.origin,
      httpOnly: true,
      secure: target.protocol === "https:",
      sameSite: "Lax",
    },
  ]);

  // GET принимает только HttpOnly cookie, одноразово ротирует refresh и выдаёт
  // session-cookie. Бывший JSON/bearer POST намеренно больше не существует.
  const response = await page.goto("/api/auth/restore?next=/dashboard");
  expect(response?.ok(), `/api/auth/restore вернул ${response?.status()}`).toBeTruthy();
  await expect(page).toHaveURL(/\/dashboard/);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
