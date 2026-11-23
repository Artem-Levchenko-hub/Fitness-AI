import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ recordSet: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: async () => ({ id: "user" }) }));
vi.mock("@/lib/repos/workouts.repo", () => ({
  recordSet: mocks.recordSet, cancelWorkout: vi.fn(), deleteSet: vi.fn(), deleteWorkout: vi.fn(), startWorkoutFromTemplate: vi.fn(),
}));
vi.mock("@/lib/repos/plan-from-history.repo", () => ({ getOrCreateNextWorkoutTemplate: vi.fn() }));
vi.mock("@/server/finish-strength-workout", () => ({ finishStrengthWorkout: vi.fn() }));

import { recordSetAction } from "./workouts";

function entry(completedAt?: string): FormData {
  const form = new FormData();
  const values = { workoutId: "00000000-0000-4000-8000-000000000001", workoutExerciseId: "00000000-0000-4000-8000-000000000002", setIndex: "0", weightKg: "45", reps: "8" };
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  if (completedAt != null) form.set("completedAt", completedAt);
  return form;
}

const now = Date.parse("2026-11-23T12:00:00.000Z");
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => { vi.restoreAllMocks(); });

describe("web set capture time", () => {
  it("keeps the actual offline time when replayed hours later", async () => {
    const captured = "2026-11-23T10:00:00.000Z";
    await expect(recordSetAction({ status: "idle" }, entry(captured))).resolves.toEqual({ status: "idle" });
    expect(mocks.recordSet).toHaveBeenCalledWith("user", expect.any(String), expect.objectContaining({ completedAt: new Date(captured) }));
  });
  it("keeps older form callers working without a capture timestamp", async () => {
    await expect(recordSetAction({ status: "idle" }, entry())).resolves.toEqual({ status: "idle" });
    expect(mocks.recordSet).toHaveBeenCalledWith("user", expect.any(String), expect.objectContaining({ completedAt: undefined }));
  });
  it("rejects malformed capture time without writing a set", async () => {
    expect((await recordSetAction({ status: "idle" }, entry("not-a-date"))).status).toBe("error");
    expect(mocks.recordSet).not.toHaveBeenCalled();
  });
  it("clamps a fast device clock to the server time", async () => {
    await recordSetAction({ status: "idle" }, entry("2026-11-24T12:00:00.000Z"));
    expect(mocks.recordSet).toHaveBeenCalledWith("user", expect.any(String), expect.objectContaining({ completedAt: new Date(now) }));
  });
});
