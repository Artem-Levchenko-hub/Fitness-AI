import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";

const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  execute: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db }));

import { finishWorkout, listInactiveStrengthWorkouts, recordSet, startMobileWorkoutFromTemplate, startWorkoutFromTemplate } from "./workouts.repo";

function selectRows(rows: unknown[]) {
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    limit: () => query,
    orderBy: () => query,
    for: () => query,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
  db.select.mockReturnValueOnce(query);
  return query;
}

function updateRows(rows: unknown[]) {
  db.update.mockReturnValueOnce({
    set: () => ({ where: () => ({ returning: async () => rows }) }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  db.transaction.mockImplementation((operation) => operation(db));
});

it("encodes the inactivity deadline as a PostgreSQL timestamp parameter", async () => {
  const having = vi.fn().mockResolvedValue([]);
  const query = {
    from: () => query,
    innerJoin: () => query,
    where: () => query,
    groupBy: () => ({ having }),
  };
  db.select.mockReturnValueOnce(query);
  const cutoff = new Date("2026-11-23T12:00:00.000Z");

  await expect(listInactiveStrengthWorkouts(cutoff)).resolves.toEqual([]);

  const compiled = new PgDialect().sqlToQuery(having.mock.calls[0][0]);
  expect(compiled.params).toEqual([cutoff.toISOString()]);
});

describe("strength workout starts", () => {
  const userId = "athlete-1";
  const templateId = "template-1";
  const clientWorkoutId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";

  it("replays a native start before touching the template or the current active workout", async () => {
    selectRows([{ id: "prior-workout" }]);

    await expect(startMobileWorkoutFromTemplate(userId, templateId, clientWorkoutId)).resolves.toEqual({ id: "prior-workout" });
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("preserves the current active workout when the native start has a new key", async () => {
    selectRows([]);
    selectRows([{ id: templateId, name: "Ноги" }]);
    selectRows([{ id: "current-workout" }]);

    await expect(startMobileWorkoutFromTemplate(userId, templateId, clientWorkoutId)).resolves.toEqual({ error: "active_workout_exists" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("resumes the active workout on a web start without cancelling its results", async () => {
    selectRows([{ id: templateId, name: "Ноги" }]);
    selectRows([{ id: "current-workout" }]);

    const result = await startWorkoutFromTemplate(userId, templateId);
    expect(result).toEqual({ id: "current-workout" });
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe("strength workout finish", () => {
  it("sets the finish note and queues analysis only for the winning transition", async () => {
    const userId = "athlete-1";
    const workoutId = "workout-1";
    selectRows([{ status: "active", startedAt: new Date() }]);
    updateRows([{ id: workoutId }]);
    selectRows([]);
    const note = { content: "Легко", source: "manual" } as const;
    const insert = vi.fn();
    db.insert.mockReturnValue({ values: insert });

    await expect(finishWorkout(userId, workoutId, note)).resolves.toBe("changed");
    expect(db.insert.mock.calls).toEqual([[schema.workoutNotes], [schema.aiJobs]]);
    expect(insert).toHaveBeenNthCalledWith(1, { userId, workoutId, ...note });
    expect(insert).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId, workoutId, kind: "post_workout", status: "pending" }));

    selectRows([{ status: "completed" }]);
    await expect(finishWorkout(userId, workoutId, note)).resolves.toBe("already_applied");
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});

describe("inactive strength completion", () => {
  const startedAt = new Date("2026-11-22T10:00:00Z");
  const completedAt = new Date("2026-11-22T11:00:00Z");
  const cutoff = new Date("2026-11-23T11:00:00Z");

  function snapshot(savedAt: Date, count = 3) {
    selectRows([{ status: "active", startedAt }]);
    selectRows([{ id: "workout", status: "active", startedAt, templateId: null }]);
    selectRows([{ id: "exercise", exerciseId: "squat", targetSets: 3, myoReps: false }]);
    selectRows(Array.from({ length: count }, (_, setIndex) => ({ workoutExerciseId: "exercise", setIndex, completedAt, savedAt })));
  }

  it("does not finish a delayed upload until one hour after its server save", async () => {
    snapshot(new Date("2026-11-23T11:30:00Z"));
    await expect(finishWorkout("user", "workout", undefined, { inactiveBefore: cutoff })).resolves.toBe("not_ready");
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("leaves an incomplete plan active even after many hours", async () => {
    snapshot(completedAt, 2);
    await expect(finishWorkout("user", "workout", undefined, { inactiveBefore: cutoff })).resolves.toBe("not_ready");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("finishes at the actual last approach rather than after the idle hour", async () => {
    snapshot(completedAt);
    const set = vi.fn(() => ({ where: () => ({ returning: async () => [{ id: "workout" }] }) }));
    db.update.mockReturnValueOnce({ set });
    selectRows([]);
    db.insert.mockReturnValue({ values: vi.fn() });
    await expect(finishWorkout("user", "workout", undefined, { inactiveBefore: cutoff })).resolves.toBe("changed");
    expect(set).toHaveBeenCalledWith({ status: "completed", finishedAt: completedAt, totalDurationSeconds: 3600 });
    expect(db.insert).toHaveBeenCalledExactlyOnceWith(schema.aiJobs);
  });

  it("preserves the actual offline timestamp while storing server receipt separately", async () => {
    selectRows([{ id: "workout", status: "active" }]);
    selectRows([{ id: "exercise" }]);
    selectRows([{ last: -1, occupied: false }]);
    const values = vi.fn(() => ({ onConflictDoNothing: () => ({ returning: async () => [{ id: "set" }] }) }));
    db.insert.mockReturnValueOnce({ values });
    await recordSet("user", "workout", { workoutExerciseId: "exercise", completedAt, weightKg: 30, reps: 10, clientSetId: "offline-key" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ completedAt, clientSetId: "offline-key", savedAt: expect.any(Object) }));
  });

  it("keeps a late offline set after automatic finish and extends its actual finish time", async () => {
    selectRows([{ id: "workout", status: "completed", startedAt, finishedAt: new Date("2026-11-22T10:30:00Z") }]);
    selectRows([{ id: "exercise" }]);
    selectRows([{ last: 2, occupied: false }]);
    db.insert.mockReturnValueOnce({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => [{ id: "late-set" }] }) }) });
    const set = vi.fn(() => ({ where: async () => undefined }));
    db.update.mockReturnValueOnce({ set });
    await recordSet("user", "workout", { workoutExerciseId: "exercise", completedAt, weightKg: 30, reps: 10 });
    expect(set).toHaveBeenCalledWith({ finishedAt: completedAt, totalDurationSeconds: 3600 });
    expect(db.insert).toHaveBeenCalledExactlyOnceWith(schema.workoutSets);
  });
});
