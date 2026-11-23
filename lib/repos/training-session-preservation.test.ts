import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock("@/db/client", () => ({ db }));
import { startCardioFromPreset } from "./cardio.repo";
import { startCircuit } from "./circuits.repo";

beforeEach(() => {
  vi.resetAllMocks();
  db.transaction.mockImplementation((operation) => operation(db));
  const query = {
    from: () => query, where: () => query, orderBy: () => query,
    limit: () => Promise.resolve([{ id: "unfinished" }]),
  };
  db.select.mockReturnValue(query);
});

describe("unfinished format sessions", () => {
  it("resumes cardio instead of cancelling it on another start", async () => {
    await expect(startCardioFromPreset("user", { preset: "tabata", name: "Cardio" })).resolves.toEqual({ id: "unfinished" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("resumes circuit instead of cancelling it on another start", async () => {
    await expect(startCircuit("user", { name: "Circuit", totalRounds: 3, restBetweenRoundsSec: 60, restBetweenExercisesSec: 15, exercises: [{ exerciseId: "exercise", kind: "reps", targetReps: 10 }] })).resolves.toEqual({ id: "unfinished" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
