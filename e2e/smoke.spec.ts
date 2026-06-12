import { test, expect } from "@playwright/test";

/**
 * H7.3 — критические потоки, гейт перед каждым consolidation-слайсом H7.
 *
 * Этот первый под-слайс — ТОЛЬКО read-only экраны (ничего не пишут в прод-БД).
 * Мутирующий поток «создать → завершить → AI-разбор виден» с очисткой
 * throwaway-юзера — отдельный под-слайс H7.3 (требует cleanup-машинерии).
 */

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
