import { beforeEach, describe, expect, it, vi } from "vitest";

import { FormatWriteError } from "@/lib/repos/training-format-write";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
  getCardioForUser: vi.fn(),
  getActiveCardioId: vi.fn(),
  listRecentCardio: vi.fn(),
  listCardioTemplates: vi.fn(),
  startCardioFromPreset: vi.fn(),
  startCardioFromTemplate: vi.fn(),
  logCardioBlock: vi.fn(),
  finishCardioWorkout: vi.fn(),
  cancelCardioWorkout: vi.fn(),
  getCircuitForUser: vi.fn(),
  getActiveCircuitId: vi.fn(),
  listCircuits: vi.fn(),
  listCircuitTemplates: vi.fn(),
  startCircuit: vi.fn(),
  startCircuitFromTemplate: vi.fn(),
  logCircuitRound: vi.fn(),
  finishCircuitWorkout: vi.fn(),
  cancelCircuit: vi.fn(),
  listExercises: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => mocks);
vi.mock("next/cache", () => mocks);
vi.mock("@/lib/repos/cardio.repo", () => mocks);
vi.mock("@/lib/repos/cardio-templates.repo", () => mocks);
vi.mock("@/lib/repos/circuits.repo", () => mocks);
vi.mock("@/lib/repos/circuit-templates.repo", () => mocks);
vi.mock("@/lib/repos/exercises.repo", () => mocks);
vi.mock("@/server/finish-circuit-workout", () => mocks);

import { GET, POST } from "./route";

const endpoint = "https://fitnesss.online/api/mobile/v1/formats";
const accountId = "athlete-1";
const workoutId = "2b086e22-ab4f-4dc4-a04b-57bb54114430";
const templateId = "151e17c8-d101-49f8-8d4a-781e9a4f6fc2";
const exerciseId = "95a778e5-f420-4c2a-8e53-7e4c223f0e2e";
const startCardio = {
  accountId, kind: "cardio", action: "start", clientWorkoutId: workoutId,
  preset: "custom", name: "Интервалы", rounds: 4, workSec: 30, restSec: 0,
};
const startCircuit = {
  accountId, kind: "circuit", action: "start", clientWorkoutId: workoutId,
  name: "Круг", totalRounds: 3, restBetweenRoundsSec: 30, restBetweenExercisesSec: 0,
  exercises: [{ exerciseId, kind: "reps", targetReps: 10 }],
};

function submit(payload: object) {
  return POST(new Request(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accountId, ...payload }),
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ id: accountId });
  mocks.getCardioForUser.mockResolvedValue(null);
  mocks.getCircuitForUser.mockResolvedValue(null);
});

describe("mobile training formats", () => {
  it("requires authentication for the overview and mutations", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET(new Request(endpoint))).status).toBe(401);
    expect((await submit(startCardio)).status).toBe(401);
    expect(mocks.listRecentCardio).not.toHaveBeenCalled();
    expect(mocks.startCardioFromPreset).not.toHaveBeenCalled();
  });

  it("returns private overview data scoped to the session account", async () => {
    const template = { id: templateId, name: "Кардио", description: null, metaLine: "4 минуты" };
    mocks.getActiveCardioId.mockResolvedValue(workoutId);
    mocks.getActiveCircuitId.mockResolvedValue(null);
    mocks.listRecentCardio.mockResolvedValue([]);
    mocks.listCircuits.mockResolvedValue([]);
    mocks.listCardioTemplates.mockResolvedValue([template]);
    mocks.listCircuitTemplates.mockResolvedValue([]);

    const response = await GET(new Request(endpoint));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      accountId,
      cardio: { activeId: workoutId, recent: [], templates: [template] },
      circuit: { activeId: null, recent: [], templates: [] },
    });
    expect(mocks.listCardioTemplates).toHaveBeenCalledWith(accountId);
    expect(mocks.listCircuits).toHaveBeenCalledWith(accountId);
  });

  it("returns 404 when a detail lookup has no owned workout", async () => {
    const response = await GET(new Request(`${endpoint}?kind=circuit&id=${workoutId}`));
    expect(response.status).toBe(404);
    expect(mocks.getCircuitForUser).toHaveBeenCalledWith(accountId, workoutId);
  });

  it("returns exercise choices scoped to the account without returning owner or muscle metadata", async () => {
    mocks.listExercises.mockResolvedValue([
      { id: exerciseId, ownerUserId: accountId, nameRu: "Приседания", nameEn: "Squats" },
    ]);
    const response = await GET(new Request(`${endpoint}?exercises=1`));
    expect(await response.json()).toEqual({
      accountId,
      exercises: [{ id: exerciseId, nameRu: "Приседания", nameEn: "Squats" }],
    });
    expect(mocks.listExercises).toHaveBeenCalledWith(accountId);
    expect(mocks.listCircuits).not.toHaveBeenCalled();
  });

  it("rejects a mutation for a previous account", async () => {
    const response = await submit({ ...startCardio, accountId: "athlete-other" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "account_changed" });
    expect(mocks.startCardioFromPreset).not.toHaveBeenCalled();
  });

  it("starts custom cardio with zero rest and passes the stable retry UUID", async () => {
    mocks.startCardioFromPreset.mockResolvedValue({ id: workoutId });
    const response = await submit({ ...startCardio, clientWorkoutId: workoutId.toUpperCase() });
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.startCardioFromPreset).toHaveBeenCalledWith(
      accountId, { name: "Интервалы", preset: "custom", params: { rounds: 4, workSec: 30, restSec: 0 } },
      { clientWorkoutId: workoutId },
    );
  });

  it("acknowledges an existing start before looking up the template again", async () => {
    mocks.getCardioForUser.mockResolvedValue({ workout: { id: workoutId }, blocks: [] });
    const response = await submit({ kind: "cardio", action: "start_template", clientWorkoutId: workoutId, templateId });
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.startCardioFromTemplate).not.toHaveBeenCalled();
  });

  it("rejects ad-hoc circuit plans that reference unavailable exercises", async () => {
    mocks.listExercises.mockResolvedValue([]);
    const response = await submit(startCircuit);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "exercise_not_found" });
    expect(mocks.startCircuit).not.toHaveBeenCalled();
  });

  it("validates the target that corresponds to the circuit exercise kind", async () => {
    const response = await submit({
      ...startCircuit, exercises: [{ exerciseId, kind: "duration", targetReps: 10 }],
    });
    expect(response.status).toBe(400);
    expect(mocks.startCircuit).not.toHaveBeenCalled();
  });

  it("does not confirm a log for a block outside the owned active cardio", async () => {
    mocks.logCardioBlock.mockRejectedValue(new FormatWriteError("block_not_found", "Недоступный блок"));
    const response = await submit({
      kind: "cardio", action: "log", workoutId, blockId: exerciseId, actualDurationSec: 15,
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "block_not_found" });
    expect(mocks.logCardioBlock).toHaveBeenCalledWith(
      accountId, workoutId, { blockId: exerciseId, actualDurationSec: 15 }, { activeOnly: true },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("records a skipped circuit exercise without inventing actual values", async () => {
    const response = await submit({
      kind: "circuit", action: "log", workoutId, circuitExerciseId: exerciseId, roundNumber: 2, skipped: true,
    });
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.logCircuitRound).toHaveBeenCalledWith(
      accountId, workoutId, { circuitExerciseId: exerciseId, roundNumber: 2, skipped: true }, { activeOnly: true },
    );
  });

  it("applies circuit completion via the shared web workflow", async () => {
    mocks.finishCircuitWorkout.mockResolvedValue("changed");
    const response = await submit({ kind: "circuit", action: "finish", workoutId, notes: "Хорошо" });
    expect(await response.json()).toEqual({ workoutId });
    expect(mocks.finishCircuitWorkout).toHaveBeenCalledWith(accountId, workoutId, "Хорошо");
  });

  it("does not confirm finish when the workout has already been cancelled", async () => {
    mocks.finishCardioWorkout.mockResolvedValue("workout_status_conflict");
    const response = await submit({ kind: "cardio", action: "finish", workoutId });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "workout_status_conflict" });
  });
});
