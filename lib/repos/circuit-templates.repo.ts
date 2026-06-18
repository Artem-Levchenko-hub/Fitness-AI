import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  buildCircuitAdaptation,
  freshSwapTarget,
  median,
  type CircuitChange,
  type CircuitPerf,
  type CircuitPlan,
  type CircuitTemplatePreset,
  type CircuitTemplateRowForEdit,
} from "@/lib/domain";
import { pickSubstitute } from "@/lib/domain/programs/adapt";
import { startCircuit } from "@/lib/repos/circuits.repo";

export type CircuitTemplateListItem = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
  /** Тренер уже адаптировал шаблон под факт (бейдж «обновлён тренером»). */
  adapted: boolean;
};

/** H14.2 — список круговых шаблонов пользователя для /templates (R-7: userId
 *  явный). Зеркалит listTemplates силовых: счёт упражнений, не-архивные,
 *  свежие сверху. Питает единую поверхность через mergeTemplateList. */
export async function listCircuitTemplates(
  userId: string,
): Promise<CircuitTemplateListItem[]> {
  const rows = await db
    .select({
      id: schema.circuitTemplates.id,
      name: schema.circuitTemplates.name,
      description: schema.circuitTemplates.description,
      updatedAt: schema.circuitTemplates.updatedAt,
      lastAdaptedCircuitWorkoutId:
        schema.circuitTemplates.lastAdaptedCircuitWorkoutId,
      exerciseCount: count(schema.circuitTemplateExercises.id),
    })
    .from(schema.circuitTemplates)
    .leftJoin(
      schema.circuitTemplateExercises,
      eq(
        schema.circuitTemplateExercises.circuitTemplateId,
        schema.circuitTemplates.id,
      ),
    )
    .where(
      and(
        eq(schema.circuitTemplates.userId, userId),
        isNull(schema.circuitTemplates.archivedAt),
      ),
    )
    .groupBy(schema.circuitTemplates.id)
    .orderBy(desc(schema.circuitTemplates.updatedAt));

  return rows.map(({ lastAdaptedCircuitWorkoutId, ...r }) => ({
    ...r,
    adapted: lastAdaptedCircuitWorkoutId != null,
  }));
}

/** H14.2 — старт круговой из шаблона: читает пресет (R-7: фильтр по userId,
 *  чужой/несуществующий → ошибка), делегирует в startCircuit (ноль дубля
 *  логики старта — тот же G2-инвариант: отменяет прошлую active-круговую).
 *  Зеркало cloneCircuit, но источник — circuit_templates, а не прошлый сеанс. */
export async function startCircuitFromTemplate(
  userId: string,
  templateId: string,
): Promise<{ id: string }> {
  const [tpl] = await db
    .select()
    .from(schema.circuitTemplates)
    .where(
      and(
        eq(schema.circuitTemplates.id, templateId),
        eq(schema.circuitTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) throw new Error("Круговой шаблон не найден или не твой");

  const exercises = await db
    .select()
    .from(schema.circuitTemplateExercises)
    .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId))
    .orderBy(asc(schema.circuitTemplateExercises.orderIdx));

  return startCircuit(userId, {
    name: tpl.name,
    // Связь сессии с шаблоном-источником: после finish тренер адаптирует ИМЕННО
    // этот шаблон на месте под факт (повторы/время/отдыхи/круги).
    sourceTemplateId: templateId,
    totalRounds: tpl.totalRounds,
    restBetweenRoundsSec: tpl.restBetweenRoundsSec,
    restBetweenExercisesSec: tpl.restBetweenExercisesSec,
    exercises: exercises.map((e) => ({
      exerciseId: e.exerciseId,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes,
    })),
  });
}

/** H14.5b — грузит круговой шаблон + упражнения для редактирования (R-7:
 *  userId явный, чужой/несуществующий → null). Несёт id строк упражнений
 *  (стабильный uid для билдера) и orderIdx (сортировка в toCircuitBuilderInitial). */
export async function getCircuitTemplateForEdit(
  userId: string,
  templateId: string,
): Promise<CircuitTemplateRowForEdit | null> {
  const [tpl] = await db
    .select()
    .from(schema.circuitTemplates)
    .where(
      and(
        eq(schema.circuitTemplates.id, templateId),
        eq(schema.circuitTemplates.userId, userId),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  const exercises = await db
    .select()
    .from(schema.circuitTemplateExercises)
    .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId))
    .orderBy(asc(schema.circuitTemplateExercises.orderIdx));

  return {
    id: tpl.id,
    name: tpl.name,
    totalRounds: tpl.totalRounds,
    restBetweenRoundsSec: tpl.restBetweenRoundsSec,
    restBetweenExercisesSec: tpl.restBetweenExercisesSec,
    exercises: exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      orderIdx: e.orderIdx,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
      notes: e.notes,
    })),
  };
}

/** H14.5b — обновляет круговой шаблон одной транзакцией: проверяет владение
 *  (R-7: userId-фильтр, чужой/несуществующий → ошибка), обновляет параметры
 *  круга, ПОЛНОСТЬЮ заменяет упражнения (delete-then-insert — порядок/состав
 *  могли поменяться целиком). updatedAt поднимается через $onUpdate. */
export async function updateCircuitTemplate(
  userId: string,
  templateId: string,
  preset: CircuitTemplatePreset,
): Promise<void> {
  if (preset.exercises.length === 0) {
    throw new Error("В круговом шаблоне должно быть хотя бы одно упражнение");
  }

  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: schema.circuitTemplates.id })
      .from(schema.circuitTemplates)
      .where(
        and(
          eq(schema.circuitTemplates.id, templateId),
          eq(schema.circuitTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Круговой шаблон не найден или не твой");

    await tx
      .update(schema.circuitTemplates)
      .set({
        name: preset.name,
        description: preset.description,
        totalRounds: preset.totalRounds,
        restBetweenRoundsSec: preset.restBetweenRoundsSec,
        restBetweenExercisesSec: preset.restBetweenExercisesSec,
        updatedAt: new Date(),
      })
      .where(eq(schema.circuitTemplates.id, templateId));

    await tx
      .delete(schema.circuitTemplateExercises)
      .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId));

    await tx.insert(schema.circuitTemplateExercises).values(
      preset.exercises.map((e) => ({
        circuitTemplateId: templateId,
        exerciseId: e.exerciseId,
        orderIdx: e.orderIdx,
        kind: e.kind,
        targetReps: e.targetReps,
        targetDurationSec: e.targetDurationSec,
        targetWeightKg: e.targetWeightKg,
        notes: e.notes,
      })),
    );
  });
}

/** H14.1 — создаёт круговой шаблон + его упражнения одной транзакцией.
 *  R-7: userId явный, шаблон принадлежит вызывающему. Пресет уже нормализован
 *  чистой buildCircuitTemplatePreset (orderIdx/kind-поля выставлены). */
export async function createCircuitTemplate(
  userId: string,
  preset: CircuitTemplatePreset,
): Promise<{ id: string }> {
  if (preset.exercises.length === 0) {
    throw new Error("В круговом шаблоне должно быть хотя бы одно упражнение");
  }

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    await tx.insert(schema.circuitTemplates).values({
      id,
      userId,
      name: preset.name,
      description: preset.description,
      totalRounds: preset.totalRounds,
      restBetweenRoundsSec: preset.restBetweenRoundsSec,
      restBetweenExercisesSec: preset.restBetweenExercisesSec,
    });

    await tx.insert(schema.circuitTemplateExercises).values(
      preset.exercises.map((e) => ({
        circuitTemplateId: id,
        exerciseId: e.exerciseId,
        orderIdx: e.orderIdx,
        kind: e.kind,
        targetReps: e.targetReps,
        targetDurationSec: e.targetDurationSec,
        targetWeightKg: e.targetWeightKg,
        notes: e.notes,
      })),
    );

    return { id };
  });
}

/** Агрегаты факта круговой сессии (из circuit_round_logs, не-skip) для доменной
 *  адаптации шаблона: по упражнению — медианы повторов/времени/веса и сколько
 *  кругов отработано; по сессии — пройденные круги и медиана RPE. Ключ
 *  byExercise = exerciseId каталога. R-7: владение сессией проверяет вызывающий. */
export async function aggregatePerformedCircuit(
  circuitWorkoutId: string,
): Promise<CircuitPerf> {
  const exRows = await db
    .select({
      id: schema.circuitExercises.id,
      exerciseId: schema.circuitExercises.exerciseId,
    })
    .from(schema.circuitExercises)
    .where(eq(schema.circuitExercises.circuitWorkoutId, circuitWorkoutId));
  const exerciseIdByCircuitEx = new Map(
    exRows.map((e) => [e.id, e.exerciseId] as const),
  );

  const logs = await db
    .select()
    .from(schema.circuitRoundLogs)
    .where(eq(schema.circuitRoundLogs.circuitWorkoutId, circuitWorkoutId));

  const acc = new Map<
    string,
    { reps: number[]; dur: number[]; weight: number[]; rounds: Set<number> }
  >();
  const rpes: number[] = [];
  let roundsCompleted = 0;

  for (const l of logs) {
    if (l.skipped) continue;
    const exerciseId = exerciseIdByCircuitEx.get(l.circuitExerciseId);
    if (!exerciseId) continue;
    roundsCompleted = Math.max(roundsCompleted, l.roundNumber);
    if (l.rpe != null) rpes.push(l.rpe);
    const a =
      acc.get(exerciseId) ??
      { reps: [], dur: [], weight: [], rounds: new Set<number>() };
    if (l.actualReps != null) a.reps.push(l.actualReps);
    if (l.actualDurationSec != null) a.dur.push(l.actualDurationSec);
    if (l.actualWeightKg != null) a.weight.push(l.actualWeightKg);
    a.rounds.add(l.roundNumber);
    acc.set(exerciseId, a);
  }

  const byExercise: CircuitPerf["byExercise"] = {};
  for (const [exerciseId, a] of acc) {
    byExercise[exerciseId] = {
      exerciseId,
      medianReps: median(a.reps),
      medianDurationSec: median(a.dur),
      medianWeightKg: median(a.weight),
      completedRounds: a.rounds.size,
      noData: a.rounds.size === 0,
    };
  }

  return { byExercise, roundsCompleted, medianRpe: median(rpes) };
}

/** Подбор замены упражнению среди СИСТЕМНЫХ упражнений той же первичной группы
 *  (зеркало findSubstitute силовых, R-04). Исключаем уже присутствующие в круге
 *  и само заменяемое. null — подходящей замены нет. */
async function findCircuitSubstitute(
  exerciseId: string,
  excludeIds: string[],
): Promise<string | null> {
  const prim = await db
    .select({ m: schema.exerciseMuscleGroups.muscleGroupKey })
    .from(schema.exerciseMuscleGroups)
    .where(
      and(
        eq(schema.exerciseMuscleGroups.exerciseId, exerciseId),
        eq(schema.exerciseMuscleGroups.role, "primary"),
      ),
    );
  const muscles = prim.map((r) => r.m);
  if (muscles.length === 0) return null;

  const rows = await db
    .select({
      id: schema.exercises.id,
      muscle: schema.exerciseMuscleGroups.muscleGroupKey,
    })
    .from(schema.exercises)
    .innerJoin(
      schema.exerciseMuscleGroups,
      and(
        eq(schema.exerciseMuscleGroups.exerciseId, schema.exercises.id),
        eq(schema.exerciseMuscleGroups.role, "primary"),
      ),
    )
    .where(
      and(
        isNull(schema.exercises.ownerUserId),
        inArray(schema.exerciseMuscleGroups.muscleGroupKey, muscles),
      ),
    )
    .orderBy(asc(schema.exercises.slug));

  const byId = new Map<
    string,
    { exerciseId: string; primaryMuscles: string[]; isStagnant: boolean }
  >();
  for (const r of rows) {
    const c = byId.get(r.id);
    if (c) c.primaryMuscles.push(r.muscle);
    else
      byId.set(r.id, {
        exerciseId: r.id,
        primaryMuscles: [r.muscle],
        isStagnant: false,
      });
  }
  return pickSubstitute(muscles, [...byId.values()], [...excludeIds, exerciseId]);
}

export type CircuitAdaptationResult = {
  adapted: boolean;
  changes: CircuitChange[];
  swap: { fromExerciseId: string; toExerciseId: string } | null;
};

/** Оркестратор адаптации кругового шаблона ПОСЛЕ завершённой круговой: тренер
 *  правит шаблон-источник НА МЕСТЕ под факт (повторы/время/вес, отдых между
 *  кругами и упражнениями, число кругов, изредка свап упражнения). null —
 *  сессия не из шаблона (ad-hoc) или шаблон удалён/в архиве. Идемпотентно по
 *  lastAdaptedCircuitWorkoutId (повторный прогон job = no-op). Fail-soft у
 *  вызывающего (worker). R-7: всё под userId. */
export async function adaptCircuitTemplateFromWorkout(
  userId: string,
  circuitWorkoutId: string,
): Promise<CircuitAdaptationResult | null> {
  const [w] = await db
    .select({ sourceTemplateId: schema.circuitWorkouts.sourceTemplateId })
    .from(schema.circuitWorkouts)
    .where(
      and(
        eq(schema.circuitWorkouts.id, circuitWorkoutId),
        eq(schema.circuitWorkouts.userId, userId),
      ),
    )
    .limit(1);
  if (!w?.sourceTemplateId) return null;
  const templateId = w.sourceTemplateId;

  const [tpl] = await db
    .select()
    .from(schema.circuitTemplates)
    .where(
      and(
        eq(schema.circuitTemplates.id, templateId),
        eq(schema.circuitTemplates.userId, userId),
        isNull(schema.circuitTemplates.archivedAt),
      ),
    )
    .limit(1);
  if (!tpl) return null;

  // Идемпотентность: этот шаблон уже адаптирован по этой круговой.
  if (tpl.lastAdaptedCircuitWorkoutId === circuitWorkoutId) {
    return { adapted: false, changes: [], swap: null };
  }

  const tplExercises = await db
    .select()
    .from(schema.circuitTemplateExercises)
    .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId))
    .orderBy(asc(schema.circuitTemplateExercises.orderIdx));
  if (tplExercises.length === 0) return null;

  // Сохраняем заметки атлета по упражнению (адаптация цели их не трогает).
  const notesByExercise = new Map(
    tplExercises.map((e) => [e.exerciseId, e.notes] as const),
  );

  const plan: CircuitPlan = {
    totalRounds: tpl.totalRounds,
    restBetweenRoundsSec: tpl.restBetweenRoundsSec,
    restBetweenExercisesSec: tpl.restBetweenExercisesSec,
    exercises: tplExercises.map((e) => ({
      exerciseId: e.exerciseId,
      kind: e.kind,
      targetReps: e.targetReps,
      targetDurationSec: e.targetDurationSec,
      targetWeightKg: e.targetWeightKg,
    })),
  };

  const perf = await aggregatePerformedCircuit(circuitWorkoutId);
  const adaptation = buildCircuitAdaptation(plan, perf);
  const changes = [...adaptation.changes];

  // Не более ОДНОГО свапа: первый хинт, которому нашлась системная замена не из
  // текущего круга. Заменённое упражнение получает свежую цель по типу.
  let swap: CircuitAdaptationResult["swap"] = null;
  const currentIds = adaptation.plan.exercises.map((e) => e.exerciseId);
  for (const hintId of adaptation.swapHints) {
    const sub = await findCircuitSubstitute(hintId, currentIds);
    if (sub) {
      swap = { fromExerciseId: hintId, toExerciseId: sub };
      break;
    }
  }

  const finalExercises = adaptation.plan.exercises.map((e) => {
    if (swap && e.exerciseId === swap.fromExerciseId) {
      return { ...e, exerciseId: swap.toExerciseId, ...freshSwapTarget(e.kind) };
    }
    return e;
  });
  if (swap) changes.push({ type: "swap", exerciseId: swap.fromExerciseId });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.circuitTemplates)
      .set({
        totalRounds: adaptation.plan.totalRounds,
        restBetweenRoundsSec: adaptation.plan.restBetweenRoundsSec,
        restBetweenExercisesSec: adaptation.plan.restBetweenExercisesSec,
        lastAdaptedCircuitWorkoutId: circuitWorkoutId,
        updatedAt: new Date(),
      })
      .where(eq(schema.circuitTemplates.id, templateId));

    await tx
      .delete(schema.circuitTemplateExercises)
      .where(eq(schema.circuitTemplateExercises.circuitTemplateId, templateId));

    await tx.insert(schema.circuitTemplateExercises).values(
      finalExercises.map((e, idx) => ({
        circuitTemplateId: templateId,
        exerciseId: e.exerciseId,
        orderIdx: idx,
        kind: e.kind,
        targetReps: e.kind === "reps" ? e.targetReps : null,
        targetDurationSec: e.kind === "duration" ? e.targetDurationSec : null,
        targetWeightKg: e.targetWeightKg,
        notes: notesByExercise.get(e.exerciseId) ?? null,
      })),
    );
  });

  return { adapted: true, changes, swap };
}
