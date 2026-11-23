import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getActiveWorkoutForUser: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/workouts.repo", () => mocks);

import { GET } from "./route";

const accountId = "athlete-1";
const workoutId = "be4591be-c585-4ded-8b34-fd1e463bcae3";
const startedAt = "2026-11-17T10:00:00.000Z";

function getWorkout(id = workoutId) {
  return GET(new Request(`https://fitnesss.online/api/mobile/v1/journal/workouts/${id}`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: accountId });
});

describe("mobile strength workout details", () => {
  it("returns an owned completed workout with its recorded sets", async () => {
    mocks.getActiveWorkoutForUser.mockResolvedValue({
      id: workoutId,
      name: "Ноги",
      status: "completed",
      startedAt: new Date(startedAt),
      exercises: [{
        id: "exercise-1",
        exerciseNameRu: "Приседания",
        targetRestSeconds: 180,
        sets: [{ id: "set-1", clientSetId: null, setIndex: 0, weightKg: 60, reps: 10, rpe: 8 }],
      }],
    });

    const response = await getWorkout();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      workout: {
        id: workoutId,
        name: "Ноги",
        status: "completed",
        startedAt,
        autoFinishAt: null,
        exercises: [{
          id: "exercise-1",
          name: "Приседания",
          targetRestSeconds: 180,
          sets: [{ id: "set-1", clientSetId: null, setIndex: 0, weightKg: 60, reps: 10 }],
        }],
      },
    });
    expect(mocks.getActiveWorkoutForUser).toHaveBeenCalledWith(accountId, workoutId);
  });

  it("does not disclose foreign or missing workout IDs", async () => {
    mocks.getActiveWorkoutForUser.mockResolvedValue(null);
    const response = await getWorkout();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workout_not_found" });
  });

  it("requires authentication even for a malformed workout ID", async () => {
    expect((await getWorkout("wrong-id")).status).toBe(404);
    mocks.getUser.mockResolvedValue(null);
    expect((await getWorkout("wrong-id")).status).toBe(401);
    expect(mocks.getActiveWorkoutForUser).not.toHaveBeenCalled();
  });
});
