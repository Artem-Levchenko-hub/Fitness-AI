import { describe, expect, it, vi } from "vitest";

// Relative import — новый mid-session test-файл с `@/`-алиасом падает
// ("Cannot find package") до правки vitest.config (память
// fitness-vitest-alias-newfile).
import {
  drainOutbox,
  finishFormData,
  recordSetFormData,
  type DrainReplayers,
} from "./outbox-drain";
import type { OutboxMutation } from "./outbox";

function recordSetMutation(
  clientId: string,
  overrides: Record<string, unknown> = {},
): OutboxMutation {
  return {
    clientId,
    kind: "recordSet",
    payload: {
      workoutId: "w1",
      workoutExerciseId: "we1",
      setIndex: "0",
      weightKg: "80",
      reps: "8",
      rpe: "",
      restSeconds: "90",
      clientSetId: clientId,
      ...overrides,
    },
    queuedAt: 1,
  };
}

function finishMutation(workoutId: string): OutboxMutation {
  return {
    clientId: `finish:${workoutId}`,
    kind: "finishWorkout",
    payload: { workoutId, feeling: "норм", feelingTag: "normal" },
    queuedAt: 2,
  };
}

describe("recordSetFormData", () => {
  it("кладёт все поля recordSet, включая clientSetId", () => {
    const fd = recordSetFormData(recordSetMutation("cid-1").payload);
    expect(fd.get("workoutId")).toBe("w1");
    expect(fd.get("workoutExerciseId")).toBe("we1");
    expect(fd.get("setIndex")).toBe("0");
    expect(fd.get("weightKg")).toBe("80");
    expect(fd.get("reps")).toBe("8");
    expect(fd.get("rpe")).toBe("");
    expect(fd.get("restSeconds")).toBe("90");
    expect(fd.get("clientSetId")).toBe("cid-1");
  });

  it("отсутствующее поле → пустая строка (а не 'undefined')", () => {
    const fd = recordSetFormData({ workoutId: "w1" });
    expect(fd.get("reps")).toBe("");
    expect(fd.get("clientSetId")).toBe("");
  });
});

describe("finishFormData", () => {
  it("кладёт workoutId/feeling/feelingTag", () => {
    const fd = finishFormData(finishMutation("w9").payload);
    expect(fd.get("workoutId")).toBe("w9");
    expect(fd.get("feeling")).toBe("норм");
    expect(fd.get("feelingTag")).toBe("normal");
  });

  it("пустой payload → пустые строки", () => {
    const fd = finishFormData({});
    expect(fd.get("workoutId")).toBe("");
    expect(fd.get("feeling")).toBe("");
  });
});

describe("drainOutbox", () => {
  function makeReplayers(
    over: Partial<DrainReplayers> = {},
  ): DrainReplayers & {
    removed: string[];
  } {
    const removed: string[] = [];
    return {
      removed,
      recordSet: vi.fn(async () => true),
      finishWorkout: vi.fn(async () => true),
      remove: vi.fn(async (id: string) => {
        removed.push(id);
      }),
      ...over,
    };
  }

  it("все успешные → synced=N, remaining=0, каждая удалена", async () => {
    const muts = [
      recordSetMutation("a"),
      recordSetMutation("b"),
      finishMutation("w1"),
    ];
    const r = makeReplayers();
    const res = await drainOutbox(muts, r);
    expect(res).toEqual({ synced: 3, remaining: 0 });
    expect(r.removed).toEqual(["a", "b", "finish:w1"]);
    expect(r.recordSet).toHaveBeenCalledTimes(2);
    expect(r.finishWorkout).toHaveBeenCalledTimes(1);
  });

  it("реплеер вернул false → мутация НЕ удалена, остаётся в очереди", async () => {
    const muts = [recordSetMutation("a"), recordSetMutation("b")];
    const r = makeReplayers({
      recordSet: vi.fn(async (m) => m.clientId === "a"),
    });
    const res = await drainOutbox(muts, r);
    expect(res).toEqual({ synced: 1, remaining: 1 });
    expect(r.removed).toEqual(["a"]); // b сохранена
  });

  it("реплеер бросил исключение → дренаж продолжается, мутация сохранена", async () => {
    const muts = [recordSetMutation("a"), recordSetMutation("b")];
    const r = makeReplayers({
      recordSet: vi.fn(async (m) => {
        if (m.clientId === "a") throw new Error("network");
        return true;
      }),
    });
    const res = await drainOutbox(muts, r);
    expect(res).toEqual({ synced: 1, remaining: 1 });
    expect(r.removed).toEqual(["b"]); // a не потеряна — ждёт следующего online
  });

  it("пустая очередь → synced=0, remaining=0, ничего не удалено", async () => {
    const r = makeReplayers();
    const res = await drainOutbox([], r);
    expect(res).toEqual({ synced: 0, remaining: 0 });
    expect(r.removed).toEqual([]);
  });
});
