import { expect, test, type Page } from "@playwright/test";

const defaultRoutes = [
  "/dashboard",
  "/create",
  "/workouts",
  "/exercises",
  "/templates",
  "/programs",
  "/schedule",
  "/friends",
  "/stats",
  "/body",
  "/nutrition",
  "/sleep",
  "/notes",
  "/library",
  "/billing",
  "/profile",
  "/settings",
] as const;

const requestedRoutes = process.env.RESPONSIVE_ROUTES?.split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const routes = requestedRoutes?.length ? requestedRoutes : defaultRoutes;

const androidViewports = [
  { name: "small-320x568", width: 320, height: 568 },
  { name: "compact-360x640", width: 360, height: 640 },
  { name: "pixel-393x873", width: 393, height: 873 },
  { name: "large-412x915", width: 412, height: 915 },
  { name: "tablet-600x960", width: 600, height: 960 },
  { name: "landscape-915x412", width: 915, height: 412 },
] as const;

type OverflowFinding = {
  element: string;
  left: number;
  right: number;
  width: number;
};

async function inspectViewport(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const describe = (element: Element) => {
      const html = element as HTMLElement;
      const id = html.id ? `#${html.id}` : "";
      const testId = html.dataset.testid
        ? `[data-testid="${html.dataset.testid}"]`
        : "";
      const classes =
        typeof html.className === "string"
          ? html.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 3)
              .map((name) => `.${CSS.escape(name)}`)
              .join("")
          : "";
      return `${element.tagName.toLowerCase()}${id}${testId}${classes}`;
    };

    const overflows: OverflowFinding[] = [];
    for (const element of document.querySelectorAll("body *")) {
      if (!visible(element)) continue;
      if (element.closest('[data-slot="sheet-content"]')) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left < -1 || rect.right > viewportWidth + 1) {
        overflows.push({
          element: describe(element),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }

    const nav = document.querySelector('nav[aria-label="Главная навигация"]');
    const navRect = nav?.getBoundingClientRect();
    return {
      documentOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overflows: overflows.slice(0, 12),
      nav:
        navRect == null
          ? null
          : {
              top: Math.round(navRect.top),
              bottom: Math.round(navRect.bottom),
              height: Math.round(navRect.height),
            },
    };
  });
}

test.describe("Android responsive audit", () => {
  test.describe.configure({ timeout: 240_000 });

  for (const viewport of androidViewports) {
    test(viewport.name, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const criticalResponses: string[] = [];
      page.on("console", (message) => {
        if (
          message.type() === "error" &&
          !message.text().startsWith("Failed to load resource:")
        ) {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() < 400) return;
        const type = response.request().resourceType();
        if (["document", "script", "stylesheet", "xhr", "fetch"].includes(type)) {
          criticalResponses.push(`${response.status()} ${type} ${response.url()}`);
        }
      });

      for (const route of routes) {
        const response = await page.goto(route, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        await page.evaluate(() =>
          Promise.race([
            document.fonts.ready,
            new Promise((resolve) => window.setTimeout(resolve, 2_000)),
          ]),
        );
        expect.soft(response?.status(), `${route}: HTTP status`).toBeLessThan(400);
        expect.soft(page.url(), `${route}: auth redirect`).not.toContain("/login");

        const audit = await inspectViewport(page);
        expect.soft(
          audit.documentOverflow,
          `${route}: document overflows by ${audit.documentOverflow}px; ${JSON.stringify(audit.overflows)}`,
        ).toBeLessThanOrEqual(1);
        expect.soft(audit.nav, `${route}: bottom navigation missing`).not.toBeNull();
        if (audit.nav) {
          expect.soft(audit.nav.bottom, `${route}: bottom navigation clipped`).toBeLessThanOrEqual(viewport.height + 1);
          expect.soft(audit.nav.height, `${route}: bottom navigation touch height`).toBeGreaterThanOrEqual(56);
        }
      }

      await page.goto("/dashboard", {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      const quickOpen = page.getByTestId("quick-activity-open");
      await expect(quickOpen).toBeVisible();
      await quickOpen.click();
      const sheet = page.locator('[data-slot="sheet-content"]');
      await expect(sheet).toBeVisible();

      const sheetAudit = await sheet.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const close = element.querySelector('[data-slot="sheet-close"]') ??
          element.querySelector('button[aria-label="Close"]');
        const closeRect = close?.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          height: Math.round(rect.height),
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          overflowY: style.overflowY,
          close:
            closeRect == null
              ? null
              : { width: Math.round(closeRect.width), height: Math.round(closeRect.height) },
        };
      });
      expect.soft(sheetAudit.top, "quick activity sheet starts above viewport").toBeGreaterThanOrEqual(0);
      expect.soft(sheetAudit.bottom, "quick activity sheet extends below viewport").toBeLessThanOrEqual(viewport.height + 1);
      if (sheetAudit.scrollHeight > sheetAudit.clientHeight + 1) {
        expect.soft(["auto", "scroll"], "quick activity sheet cannot scroll").toContain(sheetAudit.overflowY);
      }

      const repetitions = page.getByLabel("Повторы");
      await repetitions.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      const stepAudit = await repetitions.locator("..").evaluate((row) => ({
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
        children: Array.from(row.children).map((child) => {
          const rect = child.getBoundingClientRect();
          return { width: Math.round(rect.width), height: Math.round(rect.height) };
        }),
      }));
      expect.soft(stepAudit.scrollWidth, "repetition controls overflow their row").toBeLessThanOrEqual(stepAudit.clientWidth + 1);
      for (const [index, target] of stepAudit.children.entries()) {
        expect.soft(target.width, `repetition control ${index} is too narrow`).toBeGreaterThanOrEqual(44);
        expect.soft(target.height, `repetition control ${index} is too short`).toBeGreaterThanOrEqual(44);
      }

      const save = page.getByTestId("quick-activity-save");
      await save.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await expect(save).toBeVisible();
      const saveBox = await save.boundingBox();
      expect.soft(saveBox?.height ?? 0, "save target height").toBeGreaterThanOrEqual(56);

      await page.screenshot({
        path: testInfo.outputPath("dashboard-quick-activity.png"),
        fullPage: false,
      });

      expect.soft(
        consoleErrors,
        `console errors: ${consoleErrors.join(" | ")}`,
      ).toEqual([]);
      expect.soft(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect.soft(
        [...new Set(criticalResponses)],
        `critical HTTP responses: ${[...new Set(criticalResponses)].join(" | ")}`,
      ).toEqual([]);
    });
  }
});
