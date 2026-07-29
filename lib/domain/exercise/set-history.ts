import { bestEstimatedOneRepMax } from "../progression/one-rep-max";
import type { MyoSetRole } from "../workouts/myo-reps";

/** Плоская строка истории подходов одного упражнения (как из SQL-джойна
 *  workout_sets→workout_exercises→workouts), упорядоченная startedAt DESC,
 *  setIndex ASC. */
export type ExerciseHistoryRow = {
  workoutId: string;
  startedAt: Date;
  setId: string;
  setIndex: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  setType: "working" | "warmup" | "drop" | "failure";
  myoRole?: MyoSetRole | null;
};

/** Один сеанс упражнения: дата + все его подходы + лучший расчётный 1RM. */
export type ExerciseSession = {
  workoutId: string;
  date: Date;
  /** Лучший e1RM сессии (только working-подходы); 0 если working нет. */
  best1rm: number;
  sets: Array<{
    id: string;
    weightKg: number;
    reps: number;
    rpe: number | null;
    setType: ExerciseHistoryRow["setType"];
    myoRole?: MyoSetRole;
  }>;
};

/** Группирует плоские строки подходов в сессии упражнения, сохраняя порядок
 *  прихода (строки уже отсортированы новыми сверху → сессии новыми сверху).
 *  Лимит ограничивает число сессий (последние N). Чистая функция (R-7) —
 *  тестируется без БД. */
export function groupExerciseSessions(
  rows: ReadonlyArray<ExerciseHistoryRow>,
  limit = 30,
): ExerciseSession[] {
  const byWorkout = new Map<string, ExerciseSession>();

  for (const r of rows) {
    let session = byWorkout.get(r.workoutId);
    if (!session) {
      session = {
        workoutId: r.workoutId,
        date: r.startedAt,
        best1rm: 0,
        sets: [],
      };
      byWorkout.set(r.workoutId, session);
    }
    session.sets.push({
      id: r.setId,
      weightKg: r.weightKg,
      reps: r.reps,
      rpe: r.rpe,
      setType: r.setType,
      ...(r.myoRole ? { myoRole: r.myoRole } : {}),
    });
  }

  const sessions = Array.from(byWorkout.values()).slice(0, limit);
  for (const s of sessions) {
    s.best1rm = bestEstimatedOneRepMax(s.sets);
  }
  return sessions;
}
