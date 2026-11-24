import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), getUserProfile: vi.fn(), getSleepForDate: vi.fn(),
  getNutritionForDate: vi.fn(), saveMorningWellness: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/repos/body.repo", () => ({ getUserProfile: mocks.getUserProfile }));
vi.mock("@/lib/repos/sleep.repo", () => ({ getSleepForDate: mocks.getSleepForDate }));
vi.mock("@/lib/repos/nutrition.repo", () => ({ getNutritionForDate: mocks.getNutritionForDate }));
vi.mock("@/lib/repos/wellness.repo", () => ({ saveMorningWellness: mocks.saveMorningWellness }));

import { getMorningWellnessStatus, saveMorningWellnessAction } from "./morning-wellness";

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-24T03:00:00Z"));
  mocks.requireUser.mockResolvedValue({ id: "athlete" });
  mocks.getUserProfile.mockResolvedValue({ timezone: "Europe/Moscow" });
  mocks.getSleepForDate.mockResolvedValue(null);
  mocks.getNutritionForDate.mockResolvedValue(null);
});
afterEach(() => { vi.useRealTimers(); });

describe("authenticated morning entry", () => {
  it("treats an existing zero as recorded, reading sleep today and protein yesterday", async () => {
    mocks.getSleepForDate.mockResolvedValue({ hours: 0 });
    mocks.getNutritionForDate.mockResolvedValue({ proteinG: null, kcal: 2000 });
    expect(await getMorningWellnessStatus()).toEqual({
      date: "2026-11-24", proteinDate: "2026-11-23", timeZone: "Europe/Moscow",
      sleepRecorded: true, proteinRecorded: false,
    });
    expect(mocks.getSleepForDate).toHaveBeenCalledWith("athlete", "2026-11-24");
    expect(mocks.getNutritionForDate).toHaveBeenCalledWith("athlete", "2026-11-23");
  });

  it("returns no automatic prompt outside the profile's morning", async () => {
    mocks.getUserProfile.mockResolvedValue({ timezone: "America/Los_Angeles" });
    expect(await getMorningWellnessStatus()).toBeNull();
    expect(mocks.getSleepForDate).not.toHaveBeenCalled();
  });

  it("writes only the supplied field for the authenticated account", async () => {
    const form = new FormData();
    form.set("date", "2026-11-24"); form.set("hours", ""); form.set("proteinG", "135");
    expect((await saveMorningWellnessAction(form)).status).toBe("success");
    expect(mocks.saveMorningWellness).toHaveBeenCalledWith("athlete", {
      date: "2026-11-24", proteinDate: "2026-11-23", hours: undefined, proteinG: 135,
    });
  });

  it("rejects a modal left open across a local date change without misdating an entry", async () => {
    const form = new FormData(); form.set("date", "2026-11-23"); form.set("hours", "7");
    expect((await saveMorningWellnessAction(form)).status).toBe("error");
    expect(mocks.saveMorningWellness).not.toHaveBeenCalled();
  });

  it("does not turn an empty submission into zero-hour sleep or zero protein", async () => {
    const form = new FormData(); form.set("date", "2026-11-24"); form.set("hours", ""); form.set("proteinG", "");
    expect((await saveMorningWellnessAction(form)).status).toBe("error");
    expect(mocks.saveMorningWellness).not.toHaveBeenCalled();
  });
});
