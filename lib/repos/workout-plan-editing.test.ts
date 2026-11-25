import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";

const db = vi.hoisted(() => ({ transaction: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn(), delete: vi.fn() }));
vi.mock("@/db/client", () => ({ db }));

import { addWorkoutExercise, removeWorkoutExercise } from "./workouts.repo";

const conditions: unknown[] = [];
const dialect = new PgDialect();

function compile(condition: unknown) {
  return dialect.sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0]);
}

function rows(values: unknown[]) {
  const locked = vi.fn();
  const query = {
    from: () => query,
    where: (condition: unknown) => { conditions.push(condition); return query; },
    limit: () => query,
    for: (mode: string) => { locked(mode); return query; },
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(values).then(resolve),
  };
  db.select.mockReturnValueOnce(query);
  return locked;
}

beforeEach(() => {
  vi.resetAllMocks();
  conditions.length = 0;
  db.transaction.mockImplementation((operation) => operation(db));
});

describe("adding to the active strength plan", () => {
  it("appends a fresh standard assignment after every existing row without changing templates or sets", async () => {
    const locked = rows([{ id: "workout", status: "active" }]);
    rows([{ id: "movement" }]);
    rows([]);
    rows([{ last: 7 }]);
    const values = vi.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values });

    await expect(addWorkoutExercise("owner", "workout", "movement")).resolves.toEqual({ status: "added" });

    expect(locked).toHaveBeenCalledExactlyOnceWith("update");
    expect(compile(conditions[0]).params).toEqual(["workout", "owner"]);
    const visibility = compile(conditions[1]);
    expect(visibility.params).toEqual(["movement", "owner"]);
    expect(visibility.sql).toContain('"exercises"."owner_user_id" is null');
    const duplicate = compile(conditions[2]);
    expect(duplicate.params).toEqual(["workout", "movement"]);
    expect(duplicate.sql).toContain('"workout_exercises"."replaced_at" is null');
    const order = compile(conditions[3]);
    expect(order.params).toEqual(["workout"]);
    expect(order.sql).not.toContain("replaced_at");
    expect(db.insert).toHaveBeenCalledExactlyOnceWith(schema.workoutExercises);
    expect(values).toHaveBeenCalledExactlyOnceWith({
      id: expect.any(String), workoutId: "workout", exerciseId: "movement", position: 8,
      targetSets: 3, targetRepsMin: 8, targetRepsMax: 12, targetWeightKg: null, targetRestSeconds: 120,
      myoReps: false, myoMiniSets: 3, myoMiniReps: 5, myoMiniRestSeconds: 20,
    });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("starts an empty plan at position zero and retains the requested set count", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([{ id: "movement" }]);
    rows([]);
    rows([{ last: null }]);
    const values = vi.fn().mockResolvedValue(undefined);
    db.insert.mockReturnValue({ values });

    await addWorkoutExercise("owner", "workout", "movement", 5);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ position: 0, targetSets: 5 }));
  });

  it("rejects another active assignment of the same movement without adding a row", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([{ id: "movement" }]);
    rows([{ id: "active-assignment" }]);

    await expect(addWorkoutExercise("owner", "workout", "movement")).resolves.toEqual({ status: "already_added" });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects an exercise hidden from the account before any plan mutation", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([]);

    await expect(addWorkoutExercise("owner", "workout", "private-movement")).resolves.toEqual({ status: "exercise_unavailable" });
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each([0, 21, 1.5, NaN])("rejects an invalid set count %s at the repository boundary", async (targetSets) => {
    await expect(addWorkoutExercise("owner", "workout", "movement", targetSets)).resolves.toEqual({ status: "invalid_target_sets" });
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("removing from the active strength plan", () => {
  it("retires only the matching assignment while preserving its identity, saved sets, and template", async () => {
    const locked = rows([{ id: "workout", status: "active" }]);
    rows([{ id: "assignment", replacedAt: null }]);
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    db.update.mockReturnValue({ set });

    await expect(removeWorkoutExercise("owner", "workout", "assignment")).resolves.toEqual({ status: "removed" });

    expect(locked).toHaveBeenCalledExactlyOnceWith("update");
    expect(compile(conditions[0]).params).toEqual(["workout", "owner"]);
    expect(compile(conditions[1]).params).toEqual(["assignment", "workout"]);
    expect(db.update).toHaveBeenCalledExactlyOnceWith(schema.workoutExercises);
    expect(set).toHaveBeenCalledExactlyOnceWith({ replacedAt: expect.any(Date) });
    expect(compile(where.mock.calls[0][0]).params).toEqual(["assignment", "workout"]);
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("accepts a repeated removal without moving the original retirement timestamp", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([{ id: "assignment", replacedAt: new Date("2026-11-25T10:00:00Z") }]);

    await expect(removeWorkoutExercise("owner", "workout", "assignment")).resolves.toEqual({ status: "already_removed" });
    expect(db.update).not.toHaveBeenCalled();
  });

  it("rejects a row from a different workout without changing either session", async () => {
    rows([{ id: "workout", status: "active" }]);
    rows([]);

    await expect(removeWorkoutExercise("owner", "workout", "foreign-assignment")).resolves.toEqual({ status: "exercise_not_found" });
    expect(compile(conditions[1]).params).toEqual(["foreign-assignment", "workout"]);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe.each([
  ["add", () => addWorkoutExercise("owner", "workout", "movement")],
  ["remove", () => removeWorkoutExercise("owner", "workout", "assignment")],
] as const)("%s ownership and active status", (_name, operation) => {
  it("rejects a foreign or missing workout before reading its exercises", async () => {
    const locked = rows([]);
    await expect(operation()).resolves.toEqual({ status: "workout_not_found" });
    expect(locked).toHaveBeenCalledWith("update");
    expect(compile(conditions[0]).params).toEqual(["workout", "owner"]);
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it.each(["completed", "cancelled"])("rejects a %s workout before reading its exercises", async (status) => {
    rows([{ id: "workout", status }]);
    await expect(operation()).resolves.toEqual({ status: "workout_not_active" });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
