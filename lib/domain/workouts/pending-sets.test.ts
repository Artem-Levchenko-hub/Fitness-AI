import { describe, expect, it } from "vitest";

import type { OutboxMutation } from "../../storage/outbox";
import {
  groupPendingByExerciseId,
  hasPendingFinish,
  pendingSetsFromOutbox,
} from "./pending-sets";

const WORKOUT = "11111111-1111-1111-1111-111111111111";
const EX_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EX_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function mut(over: Partial<OutboxMutation> & { payload?: Record<string, unknown> }): OutboxMutation {
  return {
    clientId: over.clientId ?? "cid-1",
    kind: over.kind ?? "recordSet",
    queuedAt: over.queuedAt ?? 1000,
    payload: {
      workoutId: WORKOUT,
      workoutExerciseId: EX_A,
      setIndex: "0",
      weightKg: "60",
      reps: "8",
      rpe: "",
      restSeconds: "90",
      clientSetId: over.clientId ?? "cid-1",
      ...(over.payload ?? {}),
    },
  };
}

describe("pendingSetsFromOutbox", () => {
  it("маппит валидную recordSet-мутацию этой тренировки в PendingSet", () => {
    const [s] = pendingSetsFromOutbox([mut({ clientId: "cid-1" })], WORKOUT);
    expect(s).toEqual({
      clientId: "cid-1",
      workoutExerciseId: EX_A,
      setIndex: 0,
      weightKg: 60,
      reps: 8,
      rpe: null,
    });
  });

  it("парсит численный rpe", () => {
    const [s] = pendingSetsFromOutbox(
      [mut({ clientId: "c", payload: { rpe: "8.5" } })],
      WORKOUT,
    );
    expect(s.rpe).toBe(8.5);
  });

  it("отбрасывает мутацию другой тренировки", () => {
    const other = mut({ clientId: "c", payload: { workoutId: "deadbeef" } });
    expect(pendingSetsFromOutbox([other], WORKOUT)).toEqual([]);
  });

  it("отбрасывает не-recordSet вид (fail-soft)", () => {
    const m = mut({ clientId: "c", kind: "recordSet" });
    // startWorkout — валидный kind (H15.3c-2), но в подходы попадать не должен.
    m.kind = "startWorkout";
    expect(pendingSetsFromOutbox([m], WORKOUT)).toEqual([]);
  });

  it("отбрасывает мутацию с битым payload (нет reps)", () => {
    const broken = mut({ clientId: "c", payload: { reps: "" } });
    expect(pendingSetsFromOutbox([broken], WORKOUT)).toEqual([]);
  });

  it("сортирует по setIndex по возрастанию", () => {
    const a = mut({ clientId: "a", payload: { setIndex: "2" } });
    const b = mut({ clientId: "b", payload: { setIndex: "0" } });
    const c = mut({ clientId: "c", payload: { setIndex: "1" } });
    expect(
      pendingSetsFromOutbox([a, b, c], WORKOUT).map((s) => s.clientId),
    ).toEqual(["b", "c", "a"]);
  });
});

describe("groupPendingByExerciseId", () => {
  it("группирует подходы по workoutExerciseId, каждая группа отсортирована", () => {
    const pending = pendingSetsFromOutbox(
      [
        mut({ clientId: "a1", payload: { workoutExerciseId: EX_A, setIndex: "1" } }),
        mut({ clientId: "a0", payload: { workoutExerciseId: EX_A, setIndex: "0" } }),
        mut({ clientId: "b0", payload: { workoutExerciseId: EX_B, setIndex: "0" } }),
      ],
      WORKOUT,
    );
    const grouped = groupPendingByExerciseId(pending);
    expect(grouped.get(EX_A)!.map((s) => s.clientId)).toEqual(["a0", "a1"]);
    expect(grouped.get(EX_B)!.map((s) => s.clientId)).toEqual(["b0"]);
  });

  it("пустой вход → пустая карта", () => {
    expect(groupPendingByExerciseId([]).size).toBe(0);
  });
});

describe("hasPendingFinish", () => {
  function finishMut(over: Partial<OutboxMutation> = {}): OutboxMutation {
    return {
      clientId: over.clientId ?? `finish:${WORKOUT}`,
      kind: "finishWorkout",
      queuedAt: over.queuedAt ?? 2000,
      payload: { workoutId: WORKOUT, ...(over.payload ?? {}) },
    };
  }

  it("пустая очередь → false", () => {
    expect(hasPendingFinish([], WORKOUT)).toBe(false);
  });

  it("finishWorkout этой тренировки → true", () => {
    expect(hasPendingFinish([finishMut()], WORKOUT)).toBe(true);
  });

  it("finishWorkout другой тренировки → false", () => {
    const other = finishMut({ payload: { workoutId: "deadbeef" } });
    expect(hasPendingFinish([other], WORKOUT)).toBe(false);
  });

  it("только recordSet в очереди → false", () => {
    expect(hasPendingFinish([mut({ clientId: "c" })], WORKOUT)).toBe(false);
  });

  it("finishWorkout без workoutId в payload → false (fail-soft)", () => {
    const broken: OutboxMutation = {
      clientId: "finish:x",
      kind: "finishWorkout",
      queuedAt: 2000,
      payload: {}, // workoutId отсутствует → не матчит ни одну тренировку
    };
    expect(hasPendingFinish([broken], WORKOUT)).toBe(false);
  });
});
