import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), addWorkoutExercise: vi.fn(), removeWorkoutExercise: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/require-user", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/repos/workouts.repo", () => ({
  addWorkoutExercise: mocks.addWorkoutExercise, removeWorkoutExercise: mocks.removeWorkoutExercise,
  recordSet: vi.fn(), replaceWorkoutExercise: vi.fn(), cancelWorkout: vi.fn(), deleteSet: vi.fn(), deleteWorkout: vi.fn(), startWorkoutFromTemplate: vi.fn(),
}));
vi.mock("@/lib/repos/plan-from-history.repo", () => ({ getOrCreateNextWorkoutTemplate: vi.fn() }));
vi.mock("@/server/finish-strength-workout", () => ({ finishStrengthWorkout: vi.fn() }));

import { addWorkoutExerciseAction, removeWorkoutExerciseAction } from "./workouts";

const workoutId = "00000000-0000-4000-8000-000000000001";
const exerciseId = "00000000-0000-4000-8000-000000000002";
const workoutExerciseId = "00000000-0000-4000-8000-000000000003";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "signed-in-owner" });
  mocks.addWorkoutExercise.mockResolvedValue({ status: "added" });
  mocks.removeWorkoutExercise.mockResolvedValue({ status: "removed" });
});

describe("adding a workout exercise action", () => {
  it("uses the authenticated account and defaults to three sets before refreshing the session", async () => {
    const result = await addWorkoutExerciseAction(form({ workoutId, exerciseId, userId: "forged-owner" }));
    expect(result).toEqual({ status: "success" });
    expect(mocks.addWorkoutExercise).toHaveBeenCalledExactlyOnceWith("signed-in-owner", workoutId, exerciseId, 3);
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith(`/workouts/${workoutId}`);
  });

  it.each(["1", "20"])("accepts the set-count boundary %s", async (targetSets) => {
    expect(await addWorkoutExerciseAction(form({ workoutId, exerciseId, targetSets }))).toEqual({ status: "success" });
    expect(mocks.addWorkoutExercise).toHaveBeenCalledWith("signed-in-owner", workoutId, exerciseId, Number(targetSets));
  });

  it.each(["0", "21", "1.5", "bad", ""])("rejects invalid set count %s without writing", async (targetSets) => {
    expect(await addWorkoutExerciseAction(form({ workoutId, exerciseId, targetSets }))).toMatchObject({ status: "error", message: expect.any(String) });
    expect(mocks.addWorkoutExercise).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each(["workoutId", "exerciseId"])("rejects malformed %s without writing", async (field) => {
    expect((await addWorkoutExerciseAction(form({ workoutId, exerciseId, [field]: "invalid" }))).status).toBe("error");
    expect(mocks.addWorkoutExercise).not.toHaveBeenCalled();
  });

  it.each(["workout_not_found", "workout_not_active", "exercise_unavailable", "already_added", "invalid_target_sets"])("surfaces %s without a success refresh", async (status) => {
    mocks.addWorkoutExercise.mockResolvedValue({ status });
    expect(await addWorkoutExerciseAction(form({ workoutId, exerciseId }))).toEqual({ status: "error", message: expect.any(String) });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removing a workout exercise action", () => {
  it.each(["removed", "already_removed"])("returns success and refreshed state for %s", async (status) => {
    mocks.removeWorkoutExercise.mockResolvedValue({ status });
    expect(await removeWorkoutExerciseAction(form({ workoutId, workoutExerciseId }))).toEqual({ status: "success" });
    expect(mocks.removeWorkoutExercise).toHaveBeenCalledExactlyOnceWith("signed-in-owner", workoutId, workoutExerciseId);
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith(`/workouts/${workoutId}`);
  });

  it.each(["workoutId", "workoutExerciseId"])("rejects malformed %s without writing", async (field) => {
    expect((await removeWorkoutExerciseAction(form({ workoutId, workoutExerciseId, [field]: "invalid" }))).status).toBe("error");
    expect(mocks.removeWorkoutExercise).not.toHaveBeenCalled();
  });

  it.each(["workout_not_found", "workout_not_active", "exercise_not_found"])("surfaces %s without a success refresh", async (status) => {
    mocks.removeWorkoutExercise.mockResolvedValue({ status });
    expect(await removeWorkoutExerciseAction(form({ workoutId, workoutExerciseId }))).toEqual({ status: "error", message: expect.any(String) });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

it("requires authentication before either mutation", async () => {
  mocks.requireUser.mockRejectedValue(new Error("Sign in required"));
  await expect(addWorkoutExerciseAction(form({ workoutId, exerciseId }))).rejects.toThrow("Sign in required");
  await expect(removeWorkoutExerciseAction(form({ workoutId, workoutExerciseId }))).rejects.toThrow("Sign in required");
  expect(mocks.addWorkoutExercise).not.toHaveBeenCalled();
  expect(mocks.removeWorkoutExercise).not.toHaveBeenCalled();
});
