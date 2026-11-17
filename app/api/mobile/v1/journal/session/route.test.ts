import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  startMobileWorkoutFromTemplate: vi.fn(),
  cancelWorkout: vi.fn(),
  finishWorkout: vi.fn(),
  getActiveWorkoutForUser: vi.fn(),
  getTrainingReadiness: vi.fn(),
  adaptTemplateAfterWorkout: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/workouts.repo", () => mocks);
vi.mock("@/lib/repos/recovery.repo", () => mocks);
vi.mock("@/lib/repos/training-programs.repo", () => mocks);
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { POST } from "./route";

const accountId = "athlete-1";
const templateId = "151e17c8-d101-49f8-8d4a-781e9a4f6fc2";
const clientWorkoutId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";
const workoutId = "be4591be-c585-4ded-8b34-fd1e463bcae3";
const start = { action: "start", templateId, clientWorkoutId };

function submit(data: object, options?: { accountId?: string; contentType?: string }) {
  return POST(new Request("https://fitnesss.online/api/mobile/v1/journal/session", {
    method: "POST",
    headers: { "Content-Type": options?.contentType ?? "application/json" },
    body: JSON.stringify({ accountId: options?.accountId ?? accountId, ...data }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: accountId });
});

describe("mobile strength sessions", () => {
  it("does not start a session without an authenticated account", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await submit(start)).status).toBe(401);
    expect(mocks.startMobileWorkoutFromTemplate).not.toHaveBeenCalled();
  });

  it("does not mutate the current account when the caller supplies a different account", async () => {
    const response = await submit(start, { accountId: "athlete-2" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "account_changed" });
    expect(mocks.startMobileWorkoutFromTemplate).not.toHaveBeenCalled();
  });

  it("requires JSON and a stable UUID to start", async () => {
    expect((await submit(start, { contentType: "text/plain" })).status).toBe(415);
    expect((await submit({ ...start, clientWorkoutId: "invalid" })).status).toBe(400);
    expect(mocks.startMobileWorkoutFromTemplate).not.toHaveBeenCalled();
  });

  it("returns the owned workout ID for a start or retry", async () => {
    mocks.startMobileWorkoutFromTemplate.mockResolvedValue({ id: workoutId });
    const response = await submit({ ...start, clientWorkoutId: clientWorkoutId.toUpperCase() });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.startMobileWorkoutFromTemplate).toHaveBeenCalledWith(accountId, templateId, clientWorkoutId);
  });

  it.each([
    ["template_not_found", 404],
    ["active_workout_exists", 409],
  ])("returns %s when a start cannot be applied", async (error, status) => {
    mocks.startMobileWorkoutFromTemplate.mockResolvedValue({ error });
    const response = await submit(start);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it.each(["finish", "cancel"] as const)("acknowledges retries of %s", async (action) => {
    const operation = action === "finish" ? mocks.finishWorkout : mocks.cancelWorkout;
    operation.mockResolvedValue("already_applied");
    const response = await submit({ action, workoutId });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workoutId });
    expect(operation.mock.calls[0]?.slice(0, 2)).toEqual([accountId, workoutId]);
    expect(mocks.adaptTemplateAfterWorkout).not.toHaveBeenCalled();
  });

  it.each(["finish", "cancel"] as const)("returns 404 on %s for a foreign or missing workout", async (action) => {
    const operation = action === "finish" ? mocks.finishWorkout : mocks.cancelWorkout;
    operation.mockResolvedValue("workout_not_found");
    const response = await submit({ action, workoutId });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "workout_not_found" });
  });

  it("rejects a finish after cancellation", async () => {
    mocks.finishWorkout.mockResolvedValue("workout_status_conflict");
    const response = await submit({ action: "finish", workoutId });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "workout_status_conflict" });
  });

  it("adapts the template from the completed exercises for a new finish", async () => {
    const sets = [{ weightKg: 40, reps: 10, setType: "working" }];
    const readiness = { score: 90 };
    mocks.finishWorkout.mockResolvedValue("changed");
    mocks.getActiveWorkoutForUser.mockResolvedValue({
      status: "completed",
      exercises: [{ id: "exercise-row", exerciseId: "catalog-exercise", sets }],
    });
    mocks.getTrainingReadiness.mockResolvedValue(readiness);
    mocks.adaptTemplateAfterWorkout.mockResolvedValue({ adapted: true });

    const response = await submit({ action: "finish", workoutId });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.adaptTemplateAfterWorkout).toHaveBeenCalledWith(
      accountId, workoutId, [{ exerciseId: "catalog-exercise", sets }], readiness,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/templates");
  });
});
