import { test, expect } from "@playwright/test";

/**
 * H7.3 — критические потоки, гейт перед каждым consolidation-слайсом H7.
 *
 * H7.3a — read-only экраны (ничего не пишут в прод-БД).
 * H7.3b — мутирующие потоки на детерминированной фикстуре: разбор тренировки
 *   виден + навигация в профиль друга. Фикстуру сидит scripts/e2e-seed.mjs на
 *   проде (он же чистит её через --cleanup, не оставляя данных). Тесты читают
 *   id фикстуры из env и пропускаются, когда фикстура не засеяна (как и
 *   read-only тесты при отсутствии токена) — гейт не краснеет вхолостую.
 */

const trainerWorkoutId = process.env.E2E_TRAINER_WORKOUT_ID;
const friendId = process.env.E2E_FRIEND_ID;
const circuitId = process.env.E2E_CIRCUIT_ID;
const cardioId = process.env.E2E_CARDIO_ID;

test("/stats открывается с контентом, а не error-boundary", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/stats/);
  // h1 «Статистика» — стабильный якорь, есть при любом объёме данных (R-37).
  await expect(
    page.getByRole("heading", { name: "Статистика", level: 1 }),
  ).toBeVisible();
});

test("/friends открывается со списком/empty-state", async ({ page }) => {
  await page.goto("/friends");
  await expect(page).toHaveURL(/\/friends/);
  await expect(
    page.getByRole("heading", { name: "Друзья", level: 1 }),
  ).toBeVisible();
});

test("/profile: аватар рендерится и его легенда тапабельна", async ({
  page,
}) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/profile/);
  // Легенда-чипы (H6.3) — всегда в DOM независимо от WebGL и являются тем же
  // входом в дрилл, что и тап по 3D-мышце. Доказывают «аватар тапабелен» даже
  // там, где headless-WebGL недоступен и рендерится список-фолбэк.
  const chip = page
    .getByRole("button", { name: /подходов за неделю/ })
    .first();
  await expect(chip).toBeVisible();
  await expect(chip).toBeEnabled();
});

test("/dashboard: tile-входы «Статистика» и «Друзья» ведут на /stats и /friends", async ({
  page,
}) => {
  // H9.1 — бюджет компоновки: входы «Статистика»/«Друзья» выведены на главную
  // одним рядом компактных tile (consolidation C1, фундамент H4.1/H3.1).
  // Главное действие старта остаётся выше — проверяем сами tile-входы.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  const statsTile = page.locator('main a[href="/stats"]').first();
  const friendsTile = page.locator('main a[href="/friends"]').first();
  await expect(statsTile).toBeVisible();
  await expect(statsTile).toContainText("Статистика");
  await expect(friendsTile).toBeVisible();
  await expect(friendsTile).toContainText("Друзья");

  // Tile реально проваливается в /stats.
  await statsTile.click();
  await expect(page).toHaveURL(/\/stats/);
});

test("разбор завершённой тренировки виден (TrainerResultCard)", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId,
    "E2E_TRAINER_WORKOUT_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto(`/workouts/${trainerWorkoutId}/trainer`);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}/trainer`));
  // «Оценка тренера» — eyebrow карточки разбора (TrainerResultCard), есть только
  // когда сохранённый resultJson отрендерился, а не поллер/ошибка.
  await expect(page.getByText("Оценка тренера", { exact: true })).toBeVisible();
});

test("/workouts: три формата (силовая+круговая+кардио) вперемешку, каждый открывается в свой detail", async ({
  page,
}) => {
  test.skip(
    !trainerWorkoutId || !circuitId || !cardioId,
    "E2E_TRAINER_WORKOUT_ID/E2E_CIRCUIT_ID/E2E_CARDIO_ID не заданы — засеять через scripts/e2e-seed.mjs",
  );

  // H7.4 — единый поток: фид /workouts должен показать все три формата
  // (силовая /workouts/<id>, круговая /circuits/<id>, кардио /cardio/<id>) в
  // одном списке, отсортированном по времени (новые сверху). Сид расставил
  // started_at так: кардио −45 мин, силовая −60, круговая −90 → ожидаемый
  // порядок в DOM = кардио, силовая, круговая. Ни один формат не теряется.
  await page.goto("/workouts");
  await expect(page).toHaveURL(/\/workouts/);

  const strengthHref = `/workouts/${trainerWorkoutId}`;
  const circuitHref = `/circuits/${circuitId}`;
  const cardioHref = `/cardio/${cardioId}`;

  for (const href of [strengthHref, circuitHref, cardioHref]) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }

  // Порядок в фиде = хронологический (кардио → силовая → круговая). Берём
  // позиции карточек по их href среди всех ссылок-карточек истории.
  const order = await page.evaluate(
    ({ s, c, k }) => {
      const hrefs = Array.from(
        document.querySelectorAll("main a[href]"),
      ).map((a) => a.getAttribute("href") ?? "");
      return { s: hrefs.indexOf(s), c: hrefs.indexOf(c), k: hrefs.indexOf(k) };
    },
    { s: strengthHref, c: circuitHref, k: cardioHref },
  );
  expect(order.k).toBeGreaterThanOrEqual(0);
  expect(order.k).toBeLessThan(order.s); // кардио (−45) выше силовой (−60)
  expect(order.s).toBeLessThan(order.c); // силовая (−60) выше круговой (−90)

  // Каждая карточка открывается в СВОЙ корректный detail-вид (не 404/login).
  await page.goto(circuitHref);
  await expect(page).toHaveURL(new RegExp(`/circuits/${circuitId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Круг", level: 1 }),
  ).toBeVisible();

  await page.goto(cardioHref);
  await expect(page).toHaveURL(new RegExp(`/cardio/${cardioId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Кардио", level: 1 }),
  ).toBeVisible();

  await page.goto(strengthHref);
  await expect(page).toHaveURL(new RegExp(`/workouts/${trainerWorkoutId}`));
  await expect(
    page.getByRole("heading", { name: "E2E Smoke — Жим", level: 1 }),
  ).toBeVisible();
});

test("/friends → переход в профиль друга", async ({ page }) => {
  test.skip(
    !friendId,
    "E2E_FRIEND_ID не задан — засеять через scripts/e2e-seed.mjs на проде",
  );
  await page.goto("/friends");
  // Ссылка на друга в списке «Ваши друзья» (href = /friends/<id>).
  await page.locator(`a[href="/friends/${friendId}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/friends/${friendId}`));
  // «Только просмотр» — eyebrow страницы профиля друга (read-only вид).
  await expect(
    page.getByText("Только просмотр", { exact: true }),
  ).toBeVisible();
});
