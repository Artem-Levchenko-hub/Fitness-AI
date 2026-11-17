import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getActiveWorkoutId: vi.fn(),
  getActiveWorkoutForUser: vi.fn(),
  listRecentWorkouts: vi.fn(),
  recordSet: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/workouts.repo", () => mocks);

import { GET, POST } from "./route";

const userId = "athlete-1";
const workoutId = "be4591be-c585-4ded-8b34-fd1e463bcae3";
const workoutExerciseId = "8a8d6cc9-fb2d-4baf-a19d-ec6cee8d6b33";
const clientSetId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";
const completedAt = "2026-11-17T10:00:00.000Z";
const set = { workoutId, workoutExerciseId, clientSetId, completedAt, setIndex: 2, weightKg: 42.5, reps: 8 };

function submit(data: object, accountId = userId) {
  return POST(new Request("https://fitnesss.online/api/mobile/v1/journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, ...data }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: userId });
  mocks.getActiveWorkoutId.mockResolvedValue(workoutId);
  mocks.getActiveWorkoutForUser.mockResolvedValue({
    id: workoutId,
    name: "Ноги",
    status: "active",
    exercises: [{ id: workoutExerciseId, exerciseNameRu: "Приседания", sets: [] }],
  });
  mocks.listRecentWorkouts.mockResolvedValue([]);
});

describe("mobile strength journal", () => {
  it("returns an account-scoped active workout", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      accountId: userId,
      workout: { id: workoutId, exercises: [{ id: workoutExerciseId, name: "Приседания" }] },
    });
    expect(mocks.getActiveWorkoutForUser).toHaveBeenCalledWith(userId, workoutId);
  });

  it("preserves the client ID and capture time when replaying a set", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-17T12:00:00.000Z"));
      const response = await submit(set);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ clientSetId });
      expect(mocks.recordSet).toHaveBeenCalledWith(userId, workoutId, expect.objectContaining({
        clientSetId, completedAt: new Date(completedAt), weightKg: 42.5, reps: 8,
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects an upload queued under another account", async () => {
    expect((await submit(set, "other-user")).status).toBe(409);
    expect(mocks.recordSet).not.toHaveBeenCalled();
  });

  it("keeps the queue unsent if the workout was deleted", async () => {
    mocks.getActiveWorkoutForUser.mockResolvedValue(null);
    expect((await submit(set)).status).toBe(404);
    expect(mocks.recordSet).not.toHaveBeenCalled();
  });

  it("requires a session and a stable UUID for writes", async () => {
    expect((await submit({ ...set, clientSetId: "invalid" })).status).toBe(400);
    mocks.getUser.mockResolvedValue(null);
    expect((await submit(set)).status).toBe(401);
    expect(mocks.recordSet).not.toHaveBeenCalled();
  });
});
