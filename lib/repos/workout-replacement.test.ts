import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";

const db = vi.hoisted(() => ({ transaction: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn() }));
vi.mock("@/db/client", () => ({ db }));

import { recordSet, replaceWorkoutExercise } from "./workouts.repo";

const original = {
  id: "original-row", exerciseId: "original-movement", position: 1,
  targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: 40,
  targetRestSeconds: 120, myoReps: false, myoMiniSets: 3, myoMiniReps: 5, myoMiniRestSeconds: 20,
  replacedAt: null,
};
const conditions: unknown[] = [];

function rows(values: unknown[]) {
  const locked = vi.fn();
  const query = {
    from: () => query, innerJoin: () => query, where: (condition: unknown) => { conditions.push(condition); return query; }, limit: () => query,
    orderBy: () => query, for: (mode: string) => { locked(mode); return query; },
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(values).then(resolve),
  };
  db.select.mockReturnValueOnce(query);
  return locked;
}

function snapshot(overrides = {}, completed = 1) {
  const lock = rows([{ id: "workout", status: "active" }]);
  rows([{ id: "workout", userId: "owner", status: "active", templateId: null }]);
  rows([{ ...original, ...overrides }]);
  rows(Array.from({ length: completed }, (_, setIndex) => ({ id: `s${setIndex}`, workoutExerciseId: original.id, setIndex, reps: 10, weightKg: 40 })));
  return lock;
}

beforeEach(() => {
  vi.resetAllMocks();
  conditions.length = 0;
  db.transaction.mockImplementation((fn) => fn(db));
});

describe("active workout replacement", () => {
  it("keeps performed sets on their original row and inserts only the remaining plan under a fresh ID", async () => {
    const lock = snapshot();
    rows([{ id: "new-movement" }]);
    const updates: Array<{ table: unknown; value: Record<string, unknown>; where: unknown }> = [];
    db.update.mockImplementation((table) => ({ set: (value: Record<string, unknown>) => ({ where: async (where: unknown) => { updates.push({ table, value, where }); } }) }));
    const values = vi.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values });

    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "replaced" });
    expect(lock).toHaveBeenCalledWith("update");
    expect(db.insert).toHaveBeenCalledExactlyOnceWith(schema.workoutExercises);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      workoutId: "workout", exerciseId: "new-movement", position: 2, targetSets: 2,
      targetWeightKg: null, targetRepsMin: 8, targetRepsMax: 12, myoReps: false,
    }));
    expect(values.mock.calls[0][0].id).not.toBe(original.id);
    expect(updates.every(({ table }) => table === schema.workoutExercises)).toBe(true);
    expect(updates.some(({ value }) => "exerciseId" in value)).toBe(false);
    const ownership = new PgDialect().sqlToQuery(conditions[0] as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(ownership.params).toEqual(["workout", "owner"]);
    const retirement = updates.find(({ value }) => value.replacedAt);
    expect(retirement?.value).toEqual({ replacedAt: expect.any(Date) });
  });

  it("checks replacement visibility in the DAL before mutating the session", async () => {
    snapshot();
    rows([]);
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "private-movement")).toEqual({ status: "exercise_unavailable" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    const visibility = new PgDialect().sqlToQuery(conditions.at(-1) as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(visibility.params).toEqual(["private-movement", "owner"]);
    expect(visibility.sql).toContain('"exercises"."owner_user_id" is null');
  });

  it("does not let a stale tab replace an already retired row twice", async () => {
    snapshot({ replacedAt: new Date() });
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "already_replaced" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("preserves an activated Myo cluster rather than changing its movement mid-cluster", async () => {
    snapshot({ myoReps: true });
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "myo_started" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("carries the full Myo protocol when replacing before its activation", async () => {
    snapshot({ myoReps: true }, 0);
    rows([{ id: "new-movement" }]);
    db.update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
    const values = vi.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values });
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "replaced" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ targetSets: 3, myoReps: true, myoMiniSets: 3, myoMiniRestSeconds: 20 }));
  });

  it("does not create a replacement when all scheduled sets were performed", async () => {
    snapshot({}, 3);
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "no_remaining_sets" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects replacement for completed or foreign workouts before reading exercises", async () => {
    rows([]);
    expect(await replaceWorkoutExercise("other", "workout", original.id, "new-movement")).toEqual({ status: "workout_not_found" });
    rows([{ status: "completed" }]);
    expect(await replaceWorkoutExercise("owner", "workout", original.id, "new-movement")).toEqual({ status: "workout_not_active" });
    expect(db.select).toHaveBeenCalledTimes(2);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("writes a delayed marked set to its original retired exercise with a new server receipt timestamp", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([{ id: original.id, replacedAt: new Date() }]);
    rows([{ last: 0, occupied: false }]);
    const values = vi.fn((value: Record<string, unknown>) => {
      void value;
      return { onConflictDoNothing: () => ({ returning: async () => [{ id: "late-set" }] }) };
    });
    db.insert.mockReturnValue({ values });
    await recordSet("owner", "workout", { workoutExerciseId: original.id, weightKg: 40, reps: 8, effort: "near_failure", completedAt: new Date("2026-11-23T10:00:00Z") });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ workoutExerciseId: original.id, effort: "near_failure" }));
    const query = new PgDialect().sqlToQuery(values.mock.calls[0][0].savedAt as Parameters<PgDialect["sqlToQuery"]>[0]);
    expect(query.sql).toBe("clock_timestamp()");
  });
});
