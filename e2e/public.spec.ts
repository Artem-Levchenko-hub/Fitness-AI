import { expect, test, type Page } from "@playwright/test";

const errorsByPage = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    browserErrors.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    );
  });
  errorsByPage.set(page, browserErrors);
});

test.afterEach(async ({ page }) => {
  const browserErrors = errorsByPage.get(page) ?? [];
  expect(browserErrors, "browser console and network errors").toEqual([]);
});

test("public shell and login are usable without production data", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Fitness AI/i);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");

  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: /получить код/i })).toBeEnabled();
  await expect(page.getByRole("link", { name: /политик/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /оферт/i })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("anonymous protected deep link preserves its destination", async ({ page }) => {
  await page.goto("/billing?payment=example");
  await expect(page).toHaveURL(
    /\/login\?callbackUrl=%2Fbilling%3Fpayment%3Dexample$/,
  );
});
