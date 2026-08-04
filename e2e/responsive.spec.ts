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

  // Фильтры должны переноситься, а не превращать весь экран в горизонтальную ленту.
  const filterButtons = page.locator('button[aria-pressed]');
  expect(await filterButtons.count()).toBeGreaterThan(3);
  const firstTop = await filterButtons.first().evaluate((el) => el.getBoundingClientRect().top);
  const lastTop = await filterButtons.last().evaluate((el) => el.getBoundingClientRect().top);
  expect(lastTop).toBeGreaterThan(firstTop);

  await page.goto("/templates");
  const myoTemplate = page.locator(
    `a[href="/templates/${strengthTemplateId}"]`,
  );
  await expect(myoTemplate).toContainText("Мио-репсы · 1");
  await expectNoPageOverflow(page);

  await page.goto(`/templates/${strengthTemplateId}`);
  await expect(page.getByText("Мио-репсы включены: 1")).toBeVisible();
  await page
    .getByRole("link", { name: "Настроить Мио-репсы для шаблона" })
    .click();
  await expect(
    page.getByRole("switch", { name: "Мио-репсы для этого упражнения" }),
  ).toBeVisible();
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
