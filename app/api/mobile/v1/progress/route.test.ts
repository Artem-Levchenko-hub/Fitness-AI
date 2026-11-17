import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserProfile: vi.fn(),
  listMeasurements: vi.fn(),
  addMeasurement: vi.fn(),
  dailyVolume: vi.fn(),
  workoutFrequency: vi.fn(),
  getSleepForDate: vi.fn(),
  listRecentSleep: vi.fn(),
  upsertSleep: vi.fn(),
  getNutritionForDate: vi.fn(),
  listRecentNutrition: vi.fn(),
  upsertNutrition: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/body.repo", () => mocks);
vi.mock("@/lib/repos/stats.repo", () => mocks);
vi.mock("@/lib/repos/sleep.repo", () => mocks);
vi.mock("@/lib/repos/nutrition.repo", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { GET, POST } from "./route";

const accountId = "athlete-1";
const date = "2026-11-18";
const clientEntryId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";
const savedAt = new Date("2026-11-18T06:00:00.000Z");

const measurement = {
  id: "measurement-1",
  userId: accountId,
  measuredAt: new Date("2026-11-18T00:00:00.000Z"),
  weightKg: 77.5,
  bodyFatPct: null,
  waistCm: 80,
  neckCm: null,
  chestCm: null,
  hipCm: null,
  armCm: null,
  thighCm: null,
  notes: null,
  createdAt: savedAt,
};
const sleep = {
  id: "sleep-1",
  userId: accountId,
  date,
  hours: 7.5,
  quality: 4,
  notes: "Без пробуждений",
  createdAt: savedAt,
  updatedAt: savedAt,
};
const nutrition = {
  id: "nutrition-1",
  userId: accountId,
  date,
  kcal: 2100,
  proteinG: 120.5,
  fatG: 74,
  carbsG: null,
  notes: null,
  createdAt: savedAt,
  updatedAt: savedAt,
};

function submit(input: object, selectedAccount = accountId) {
  return POST(new Request("https://fitnesss.online/api/mobile/v1/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ accountId: selectedAccount, date, ...input }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: accountId });
  mocks.getUserProfile.mockResolvedValue({ timezone: "Europe/Moscow" });
  mocks.dailyVolume.mockResolvedValue([]);
  mocks.workoutFrequency.mockResolvedValue([]);
  mocks.listMeasurements.mockResolvedValue([measurement]);
  mocks.getSleepForDate.mockResolvedValue(sleep);
  mocks.getNutritionForDate.mockResolvedValue(nutrition);
  mocks.listRecentSleep.mockResolvedValue([sleep]);
  mocks.listRecentNutrition.mockResolvedValue([nutrition]);
  mocks.addMeasurement.mockResolvedValue(measurement);
  mocks.upsertSleep.mockResolvedValue(sleep);
  mocks.upsertNutrition.mockResolvedValue(nutrition);
});

describe("mobile progress", () => {
  it("aligns the training series and the daily logs to the account's calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-17T21:30:00.000Z"));
      mocks.dailyVolume.mockResolvedValue([
        { date: "2026-10-19", volume: 80, sets: 1, reps: 8 },
        { date: "2026-11-16", volume: 145.5, sets: 3, reps: 24 },
      ]);
      mocks.workoutFrequency.mockResolvedValue([
        { date: "2026-11-16", count: 1 },
        { date, count: 2 },
      ]);
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const payload = await response.json();
      expect(payload).toMatchObject({
        accountId,
        today: date,
        measurements: [{ id: measurement.id, date, weightKg: 77.5 }],
        sleepToday: { date, hours: 7.5, notes: "Без пробуждений" },
        nutritionToday: { date, kcal: 2100, carbsG: null },
      });
      expect(payload.measurements[0]).not.toHaveProperty("userId");
      expect(payload.training).toHaveLength(30);
      expect(payload.training[0]).toEqual({
        date: "2026-10-20", volumeKg: 0, sets: 0, reps: 0, count: 0,
      });
      expect(payload.training.slice(-3)).toEqual([
        { date: "2026-11-16", volumeKg: 145.5, sets: 3, reps: 24, count: 1 },
        { date: "2026-11-17", volumeKg: 0, sets: 0, reps: 0, count: 0 },
        { date, volumeKg: 0, sets: 0, reps: 0, count: 2 },
      ]);
      expect(mocks.dailyVolume).toHaveBeenCalledWith(accountId, "30d", "Europe/Moscow");
      expect(mocks.workoutFrequency).toHaveBeenCalledWith(accountId, "30d", "Europe/Moscow");
      expect(mocks.getSleepForDate).toHaveBeenCalledWith(accountId, date);
      expect(mocks.getNutritionForDate).toHaveBeenCalledWith(accountId, date);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses a client entry ID when retrying an append-only measurement", async () => {
    const input = { kind: "measurement", clientEntryId, values: { weightKg: 77.5, waistCm: 80 } };
    const response = await submit(input);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "measurement",
      entry: { id: "measurement-1", date, weightKg: 77.5, waistCm: 80 },
    });
    expect((await submit(input)).status).toBe(200);
    expect(mocks.addMeasurement).toHaveBeenCalledTimes(2);
    expect(mocks.addMeasurement).toHaveBeenNthCalledWith(2, accountId, expect.objectContaining({
      measuredAt: new Date("2026-11-18T00:00:00.000Z"),
      weightKg: 77.5,
      waistCm: 80,
    }), clientEntryId);
    expect(mocks.upsertSleep).not.toHaveBeenCalled();
    expect(mocks.upsertNutrition).not.toHaveBeenCalled();
  });

  it("writes sleep to the authenticated user's daily log", async () => {
    const response = await submit({
      kind: "sleep",
      values: { hours: 7.5, quality: 4, notes: " Без пробуждений " },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "sleep",
      entry: { date, hours: 7.5, quality: 4, notes: "Без пробуждений" },
    });
    expect(mocks.upsertSleep).toHaveBeenCalledWith(accountId, {
      date, hours: 7.5, quality: 4, notes: "Без пробуждений",
    });
  });

  it("rounds calories and preserves omitted or individually entered macros", async () => {
    const response = await submit({
      kind: "nutrition",
      values: { kcal: 2099.6, proteinG: 120.5, fatG: 74 },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "nutrition", entry: { date, kcal: 2100, proteinG: 120.5, fatG: 74, carbsG: null },
    });
    expect(mocks.upsertNutrition).toHaveBeenCalledWith(accountId, {
      date, kcal: 2100, proteinG: 120.5, fatG: 74, carbsG: null, notes: null,
    });
  });

  it("requires authentication before reading or writing private history", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await submit({ kind: "sleep", values: { hours: 7.5 } })).status).toBe(401);
    expect(mocks.getUserProfile).not.toHaveBeenCalled();
    expect(mocks.upsertSleep).not.toHaveBeenCalled();
  });

  it("rejects a write opened under a different account", async () => {
    const response = await submit({ kind: "sleep", values: { hours: 7.5 } }, "other-user");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "account_changed" });
    expect(mocks.upsertSleep).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "sleep", date: "2026-02-31", values: { hours: 7.5 } },
    { kind: "sleep", values: { hours: 25 } },
    { kind: "sleep", values: { hours: null } },
    { kind: "sleep", values: { hours: "" } },
    { kind: "sleep", values: { hours: 8, quality: 6 } },
    { kind: "nutrition", values: { kcal: 11_000 } },
    { kind: "measurement", clientEntryId, values: { weightKg: 501 } },
    { kind: "measurement", clientEntryId, values: {} },
  ])("rejects invalid $kind fields without changing data", async (input) => {
    expect((await submit(input)).status).toBe(400);
    expect(mocks.upsertSleep).not.toHaveBeenCalled();
    expect(mocks.upsertNutrition).not.toHaveBeenCalled();
    expect(mocks.addMeasurement).not.toHaveBeenCalled();
  });
});
