import { describe, expect, it } from "vitest";

import {
  groupExerciseSessions,
  type ExerciseHistoryRow,
} from "./set-history";

/** Хелпер: строка истории с дефолтами (порядок как из SQL —
 *  startedAt DESC, setIndex ASC). */
function row(o: Partial<ExerciseHistoryRow>): ExerciseHistoryRow {
  return {
    workoutId: "w1",
    startedAt: new Date("2026-06-10T08:00:00Z"),
    setId: "s1",
    setIndex: 0,
    weightKg: 80,
    reps: 5,
    rpe: null,
    setType: "working",
    ...o,
  };
}

describe("groupExerciseSessions", () => {
  it("группирует подходы по тренировке, сессии в порядке прихода (новые сверху)", () => {
    const rows: ExerciseHistoryRow[] = [
      row({ workoutId: "w2", startedAt: new Date("2026-06-12T08:00:00Z"), setId: "a", setIndex: 0, weightKg: 100, reps: 5 }),
      row({ workoutId: "w2", startedAt: new Date("2026-06-12T08:00:00Z"), setId: "b", setIndex: 1, weightKg: 100, reps: 4 }),
      row({ workoutId: "w1", startedAt: new Date("2026-06-10T08:00:00Z"), setId: "c", setIndex: 0, weightKg: 90, reps: 6 }),
    ];

    const out = groupExerciseSessions(rows);

    expect(out).toHaveLength(2);
    expect(out[0].workoutId).toBe("w2");
    expect(out[0].sets).toHaveLength(2);
    expect(out[1].workoutId).toBe("w1");
    expect(out[1].sets).toHaveLength(1);
  });

  it("best1rm считается только по working-подходам (warmup игнор)", () => {
    const rows: ExerciseHistoryRow[] = [
      row({ setId: "warm", setIndex: 0, weightKg: 200, reps: 5, setType: "warmup" }),
      row({ setId: "work", setIndex: 1, weightKg: 100, reps: 5, setType: "working" }),
    ];

    const out = groupExerciseSessions(rows);

    expect(out).toHaveLength(1);
    // best1rm от 100×5 (≈112-117), НЕ от warmup 200×5
    expect(out[0].best1rm).toBeGreaterThan(100);
    expect(out[0].best1rm).toBeLessThan(130);
    // warmup-подход всё равно в списке (показываем все)
    expect(out[0].sets).toHaveLength(2);
  });

  it("сессия только из warmup → best1rm = 0", () => {
    const out = groupExerciseSessions([
      row({ setType: "warmup", weightKg: 50, reps: 10 }),
    ]);
    expect(out[0].best1rm).toBe(0);
  });

  it("ограничивает число сессий лимитом", () => {
    const rows: ExerciseHistoryRow[] = Array.from({ length: 5 }, (_, i) =>
      row({ workoutId: `w${i}`, setId: `s${i}` }),
    );
    const out = groupExerciseSessions(rows, 3);
    expect(out).toHaveLength(3);
    expect(out.map((s) => s.workoutId)).toEqual(["w0", "w1", "w2"]);
  });

  it("пустой вход → пустой выход", () => {
    expect(groupExerciseSessions([])).toEqual([]);
  });

  it("сохраняет поля подхода (rpe, reps, вес, тип)", () => {
    const out = groupExerciseSessions([
      row({ setId: "x", weightKg: 82.5, reps: 5, rpe: 8, setType: "working" }),
    ]);
    expect(out[0].sets[0]).toEqual({
      id: "x",
      weightKg: 82.5,
      reps: 5,
      rpe: 8,
      setType: "working",
    });
  });
});
