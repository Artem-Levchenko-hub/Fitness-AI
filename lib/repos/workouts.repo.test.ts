import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

const db = vi.hoisted(() => ({
  transaction: vi.fn(),
  execute: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/db/client", () => ({ db }));

import { finishWorkout, startMobileWorkoutFromTemplate, startWorkoutFromTemplate } from "./workouts.repo";

function selectRows(rows: unknown[]) {
  const query = {
    from: () => query,
    where: () => query,
    limit: async () => rows,
    orderBy: async () => rows,
  };
  db.select.mockReturnValueOnce(query);
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

  it("still replaces the active workout on a web start", async () => {
    selectRows([{ id: templateId, name: "Ноги" }]);
    selectRows([]);
    const cancel = vi.fn(() => ({ where: async () => [] }));
    db.update.mockReturnValueOnce({ set: cancel });
    const insert = vi.fn();
    db.insert.mockReturnValueOnce({ values: insert });

    const result = await startWorkoutFromTemplate(userId, templateId);
    expect(cancel).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: result.id, status: "active", userId }));
  });
});

describe("strength workout finish", () => {
  it("sets the finish note and queues analysis only for the winning transition", async () => {
    const userId = "athlete-1";
    const workoutId = "workout-1";
    updateRows([{ id: workoutId }]);
    selectRows([]);
    const note = { content: "Легко", source: "manual" } as const;
    const insert = vi.fn();
    db.insert.mockReturnValue({ values: insert });

    await expect(finishWorkout(userId, workoutId, note)).resolves.toBe("changed");
    expect(db.insert.mock.calls).toEqual([[schema.workoutNotes], [schema.aiJobs]]);
    expect(insert).toHaveBeenNthCalledWith(1, { userId, workoutId, ...note });
    expect(insert).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId, workoutId, kind: "post_workout", status: "pending" }));

    updateRows([]);
    selectRows([{ status: "completed" }]);
    await expect(finishWorkout(userId, workoutId, note)).resolves.toBe("already_applied");
    expect(db.insert).toHaveBeenCalledTimes(2);
  });
});
