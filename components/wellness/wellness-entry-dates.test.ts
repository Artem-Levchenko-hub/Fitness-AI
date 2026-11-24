import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sleep: vi.fn(), nutrition: vi.fn(), timeZone: "Asia/Tokyo" }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: async () => ({ id: "athlete" }) }));
vi.mock("@/lib/repos/body.repo", () => ({ getUserProfile: async () => ({ timezone: mocks.timeZone }) }));
vi.mock("@/lib/repos/sleep.repo", () => ({ getSleepForDate: mocks.sleep, listRecentSleep: async () => [] }));
vi.mock("@/lib/repos/nutrition.repo", () => ({ getNutritionForDate: mocks.nutrition, listRecentNutrition: async () => [] }));
vi.mock("@/server/actions/sleep", () => ({ upsertSleepAction: vi.fn() }));
vi.mock("@/server/actions/nutrition", () => ({ upsertNutritionAction: vi.fn() }));

import SleepPage from "@/app/(app)/sleep/page";
import NutritionPage from "@/app/(app)/nutrition/page";
import { SleepTile } from "@/components/dashboard/SleepTile";
import { NutritionTile } from "@/components/dashboard/NutritionTile";

beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  mocks.sleep.mockResolvedValue(null); mocks.nutrition.mockResolvedValue(null);
});
afterEach(() => { vi.useRealTimers(); });

it.each([
  ["2026-11-23T20:30:00Z", "Asia/Tokyo", "2026-11-24"],
  ["2026-11-24T01:30:00Z", "America/Los_Angeles", "2026-11-23"],
])("uses the profile-local day for wellness forms and tiles at %s in %s", async (instant, timeZone, localDate) => {
  vi.setSystemTime(new Date(instant)); mocks.timeZone = timeZone;
  await SleepPage(); await NutritionPage();
  await SleepTile({ userId: "athlete", timeZone }); await NutritionTile({ userId: "athlete", timeZone });
  expect(mocks.sleep.mock.calls).toEqual([["athlete", localDate], ["athlete", localDate]]);
  expect(mocks.nutrition.mock.calls).toEqual([["athlete", localDate], ["athlete", localDate]]);
});
