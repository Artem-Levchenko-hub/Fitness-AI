import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn(), finish: vi.fn() }));
vi.mock("@/lib/repos/workouts.repo", () => ({ listInactiveStrengthWorkouts: mocks.list }));
vi.mock("@/server/finish-strength-workout", () => ({ finishStrengthWorkout: mocks.finish }));
const { POST } = await import("./route");

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("CRON_SECRET", "cron-secret");
});

describe("inactive workout cron", () => {
  it("rejects missing/wrong credentials before looking up workouts", async () => {
    const response = await POST(new Request("http://localhost/api/cron/finish-inactive-workouts"));
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("fails closed in production without a configured secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await POST(new Request("http://localhost/api/cron/finish-inactive-workouts"));
    expect(response.status).toBe(401);
  });

  it("rechecks candidates through the shared finish path with the same cutoff", async () => {
    mocks.list.mockResolvedValue([{ userId: "user", id: "complete" }, { userId: "user", id: "still-working" }]);
    mocks.finish.mockResolvedValueOnce("changed").mockResolvedValueOnce("not_ready");
    const response = await POST(new Request("http://localhost/api/cron/finish-inactive-workouts", { headers: { Authorization: "Bearer cron-secret" } }));
    const cutoff = mocks.list.mock.calls[0][0];
    expect(mocks.finish).toHaveBeenCalledWith("user", "complete", undefined, { inactiveBefore: cutoff });
    await expect(response.json()).resolves.toEqual({ checked: 2, completed: 1, failed: 0 });
  });
});
