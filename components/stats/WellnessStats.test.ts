import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sleep: vi.fn(), nutrition: vi.fn(), counts: vi.fn() }));
vi.mock("@/lib/repos/sleep.repo", () => ({ getSleepRange: mocks.sleep }));
vi.mock("@/lib/repos/nutrition.repo", () => ({ getNutritionRange: mocks.nutrition }));
vi.mock("@/lib/repos/wellness.repo", () => ({ getWellnessLoggedDays: mocks.counts }));
// Recharts sizes its canvas in a browser; the server's visible totals/table remain real.
vi.mock("./WellnessCharts", () => ({ WellnessCharts: () => null }));

import { WellnessStats } from "./WellnessStats";

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
  mocks.sleep.mockResolvedValue([{ date: "2026-11-23", hours: 7.5 }]);
  mocks.nutrition.mockResolvedValue([{ date: "2026-11-23", proteinG: 130 }, { date: "2026-11-24", proteinG: null }]);
  mocks.counts.mockResolvedValue({ sleepDays: 7, proteinDays: 6 });
});
afterEach(() => { vi.useRealTimers(); });

it("shows selected-range recorded averages and daily history without counting missing protein as zero", async () => {
  const tree = await WellnessStats({ userId: "athlete", timeZone: "Europe/Moscow", range: "7d" });
  const html = renderToStaticMarkup(createElement("div", null, tree));
  expect(html).toContain("7,5");
  expect(html).toContain("130");
  expect(html).toContain("История по дням");
  expect(html).toContain("23.11.2026");
  expect(mocks.sleep).toHaveBeenCalledWith("athlete", "2026-11-18", "2026-11-24");
  expect(mocks.nutrition).toHaveBeenCalledWith("athlete", "2026-11-18", "2026-11-24");
});

it("keeps empty stats useful with links to the existing entry forms", async () => {
  mocks.sleep.mockResolvedValue([]); mocks.nutrition.mockResolvedValue([]);
  const html = renderToStaticMarkup(await WellnessStats({ userId: "athlete", timeZone: "Europe/Moscow", range: "30d" }));
  expect(html).toContain('href="/sleep"');
  expect(html).toContain('href="/nutrition"');
  expect(html).toContain("Нет записей за выбранный период");
});
