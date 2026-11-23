import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), getUserProfile: vi.fn(), getLatestMeasurement: vi.fn(),
  muscleHeatProfile: vi.fn(), muscleGroupRecords: vi.fn(), muscleLastTrained: vi.fn(),
  muscleWeeklyVolume: vi.fn(), getMuscleGroupGoals: vi.fn(),
}));
vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/body.repo", () => mocks);
vi.mock("@/lib/repos/stats.repo", () => mocks);
vi.mock("@/lib/repos/goals.repo", () => mocks);

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: "athlete-1" });
  mocks.getUserProfile.mockResolvedValue({ timezone: "Asia/Vladivostok", heightCm: 178 });
  mocks.getLatestMeasurement.mockResolvedValue({ weightKg: 78.5 });
  mocks.muscleHeatProfile.mockResolvedValue([{
    muscleKey: "chest", weeklySets: 15, sets: 16, volume7d: 720,
    lastTrainedAt: new Date("2026-11-22T12:00:00Z"),
    top3: [{ exerciseId: "press", name: "Жим", volume: 720 }],
  }]);
  mocks.muscleGroupRecords.mockResolvedValue(new Map([
    ["chest", [{ exerciseId: "press", name: "Жим", weightKg: 80, reps: 6 }]],
  ]));
  mocks.muscleLastTrained.mockResolvedValue(new Map());
  mocks.muscleWeeklyVolume.mockResolvedValue(new Map([["chest", [300, 720]]]));
  mocks.getMuscleGroupGoals.mockResolvedValue(new Map([["chest", { targetValue: 12 }]]));
});

describe("mobile body", () => {
  it("requires authentication before accessing private body history", async () => {
    mocks.getUser.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "sign_in_required" });
    expect(mocks.muscleHeatProfile).not.toHaveBeenCalled();
    expect(mocks.getUserProfile).not.toHaveBeenCalled();
  });

  it("returns the web avatar heat, history and goals for the signed in account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-23T12:00:00Z"));
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toMatchObject({
        accountId: "athlete-1", timezone: "Asia/Vladivostok", hasTrainingData: true,
        heightCm: 178, weightKg: 78.5,
        muscles: [{ key: "chest", t: 1, level: "peak", sets: 16, volume7d: 720,
          lastTrainedLabel: "вчера", weeklyVolume: [300, 720], goalTarget: 12,
          top3: [{ exerciseId: "press", name: "Жим", volume: 720 }],
          records: [{ exerciseId: "press", name: "Жим", weightKg: 80, reps: 6 }],
        }],
      });
      expect(mocks.muscleWeeklyVolume).toHaveBeenCalledWith("athlete-1", new Date(), "Asia/Vladivostok", 6);
      expect(mocks.muscleHeatProfile).toHaveBeenCalledWith("athlete-1", new Date());
      for (const query of [mocks.muscleGroupRecords, mocks.muscleLastTrained, mocks.getMuscleGroupGoals, mocks.getLatestMeasurement]) {
        expect(query).toHaveBeenCalledWith("athlete-1");
      }
    } finally { vi.useRealTimers(); }
  });

  it("keeps untrained groups empty and normalizes an invalid account timezone", async () => {
    mocks.getUserProfile.mockResolvedValue({ timezone: "broken/timezone", heightCm: null });
    mocks.getLatestMeasurement.mockResolvedValue(null);
    mocks.muscleHeatProfile.mockResolvedValue([{
      muscleKey: "chest", weeklySets: 0, sets: 0, volume7d: 0, lastTrainedAt: null, top3: [],
    }]);
    const payload = await (await GET()).json();
    expect(payload).toMatchObject({ timezone: "Europe/Moscow", heightCm: null, weightKg: null,
      hasTrainingData: false, muscles: [{ t: 0, level: "dormant", sets: 0, volume7d: 0 }],
    });
    expect(mocks.muscleWeeklyVolume.mock.calls[0][2]).toBe("Europe/Moscow");
  });
});
