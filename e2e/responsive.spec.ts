import { expect, test } from "@playwright/test";

const strengthTemplateId = process.env.E2E_STRENGTH_TEMPLATE_ID;

async function expectNoPageOverflow(page: import("@playwright/test").Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test.beforeAll(() => {
  if (!strengthTemplateId) {
    throw new Error(
      "E2E_STRENGTH_TEMPLATE_ID обязателен: сначала запустите scripts/e2e-seed.mjs",
    );
  }
});

test("mobile: exercises, Мио-репсы and quick activity fit the viewport", async ({
  page,
}) => {
  await page.goto("/exercises");
  await expect(page.getByRole("heading", { name: "Упражнения", level: 1 })).toBeVisible();
  await expectNoPageOverflow(page);

  // Скролл остаётся внутри одной строки фильтров, весь экран не растягивается.
  const muscleFilters = page.getByRole("group", { name: "Фильтр по мышцам" });
  const filterButtons = muscleFilters.getByRole("button");
  expect(await filterButtons.count()).toBeGreaterThan(3);
  const firstTop = await filterButtons.first().evaluate((el) => el.getBoundingClientRect().top);
  const lastTop = await filterButtons.last().evaluate((el) => el.getBoundingClientRect().top);
  expect(lastTop).toBe(firstTop);
  expect(
    await muscleFilters.evaluate((el) => {
      return el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX === "auto";
    }),
  ).toBe(true);
  await filterButtons.last().scrollIntoViewIfNeeded();
  await filterButtons.last().click();
  await expect(filterButtons.last()).toHaveAttribute("aria-pressed", "true");
  expect(await muscleFilters.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expectNoPageOverflow(page);

  await page.goto("/templates");
  const myoTemplate = page.locator(
    `a[href="/templates/${strengthTemplateId}"]`,
  );
  await expect(myoTemplate).toContainText("Мио-репсы · 1");
  await expectNoPageOverflow(page);

  await page.goto(`/templates/${strengthTemplateId}`);
  await expect(page.getByText("Мио-репсы включены: 1")).toBeVisible();
  await page.getByRole("link", { name: "Настроить Мио-репсы для шаблона" }).click();
  await expect(
    page
      .getByRole("group", { name: "Система подходов" })
      .getByRole("button", { name: "Myo-reps" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expectNoPageOverflow(page);

  await page.goto("/cardio/new");
  await expect(page.getByRole("heading", { name: "Выбери формат", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Сохранить как шаблон" }).first()).toBeVisible();
  await expectNoPageOverflow(page);

  await page.goto("/dashboard");
  await page.getByTestId("quick-activity-open").click();
  const sheet = page.getByTestId("quick-activity-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("quick-activity-reps")).toBeVisible();
  expect(
    await sheet.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expectNoPageOverflow(page);
});
