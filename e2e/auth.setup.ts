import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Восстанавливает прод-сессию из refresh-токена и сохраняет storageState для
 * смоук-проекта. Токен выпускается на проде:
 *   ssh kanavto-vps "bash -lc 'cd /opt/fitness-saas && \
 *     node --env-file=.env.production scripts/issue-session.mjs'"
 * и передаётся как E2E_REFRESH_TOKEN. Без токена весь набор пропускается (а не
 * падает) — гейт запускается только когда есть чем аутентифицироваться.
 */

const authFile = path.join(__dirname, ".auth", "user.json");
const token = process.env.E2E_REFRESH_TOKEN;

setup("restore prod session", async ({ request }) => {
  setup.skip(
    !token,
    "E2E_REFRESH_TOKEN не задан — выпустить через scripts/issue-session.mjs на проде",
  );

  // APIRequestContext хранит Set-Cookie так же, как browser context,
  // но не тратит время на два полных RSC-рендера до самого смоука.
  const res = await request.post("/api/auth/restore", {
    headers: { "Content-Type": "application/json" },
    data: { token },
  });
  expect(res.ok(), `/api/auth/restore вернул ${res.status()}`).toBeTruthy();

  // Доказательство, что сессия реально аутентифицирует: /dashboard не отбрасывает
  // на /login.
  const dashboard = await request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status(), "/dashboard не должен редиректить на /login").toBe(200);

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await request.storageState({ path: authFile });
});
