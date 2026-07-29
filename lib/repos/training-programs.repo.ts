import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import type { AdaptItem } from "@/lib/domain/programs/adapt";
import {
  analyzeTemplateTrends,
  type TrendLifeFactors,
  type TrendSession,
} from "@/lib/domain/coach/trend-analyzer";
import type { AiPlan } from "@/lib/domain/programs/ai-plan";
import { getLibraryProgram } from "@/lib/domain/programs/library";
import type {
  ProgramReviewInput,
  ProgramReviewResult,
} from "@/lib/domain/programs/program-review";
import type { ProgramReviewSnapshot } from "@/db/schema";
import { getActiveWorkoutForUser } from "@/lib/repos/workouts.repo";
import {
  DEFAULT_MYO_MINI_SETS,
  DEFAULT_MYO_FIRST_REST_SECONDS,
  DEFAULT_MYO_REPS_PERCENT,
  DEFAULT_MYO_REST_SECONDS,
} from "@/lib/domain/workouts/myo-reps";
import {
  appendTemplateVersion,
  createPendingTemplateVersion,
  createInitialTemplateVersion,
} from "@/lib/repos/template-versions.repo";

export type ProgramListItem = {
  id: string;
  name: string;
  /** Откуда программа: slug пресета библиотеки или null (собрана из своих). */
  librarySlug: string | null;
  dayCount: number;
  /** Активна ли — её дни видны в «Шаблонах». */
  active: boolean;
  updatedAt: Date;
};

export type ProgramDay = {
  templateId: string;
  name: string;
  dayOrder: number | null;
  exerciseCount: number;
  /** Тренер уже адаптировал этот день на месте (хотя бы раз). */
  adapted: boolean;
};

export type ProgramWithDays = {
  id: string;
  name: string;
  description: string | null;
  librarySlug: string | null;
  /** Активна ли — её дни видны в «Шаблонах» (после «Начать тренироваться»). */
  active: boolean;
  createdAt: Date;
  days: ProgramDay[];
  /** Кэш последней оценки тренером (null — ещё не оценивалась). */
  review: ProgramReviewSnapshot | null;
  /** Когда оценивали (для подписи). */
  reviewedAt: Date | null;
};

/** Системные упражнения (ownerUserId = null) по slug → id. Каталог библиотеки
 *  ссылается на упражнения по slug; копия резолвит их в реальные id. */
async function resolveSystemExerciseIds(
  slugs: string[],
): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await db
    .select({ id: schema.exercises.id, slug: schema.exercises.slug })
    .from(schema.exercises)
    .where(
      and(
        isNull(schema.exercises.ownerUserId),
        inArray(schema.exercises.slug, slugs),
      ),
    );
  return new Map(rows.map((r) => [r.slug, r.id]));
}

/** «Использовать» программу из библиотеки: глубокая копия пресета в строки
 *  пользователя — программа + по шаблону-дню на каждый день + их упражнения.
 *  Библиотека (TS-каталог) неизменна; прогресс и адаптация идут на этой копии. */
export async function copyLibraryProgramToUser(
  userId: string,
  librarySlug: string,
): Promise<{ id: string }> {
  const preset = getLibraryProgram(librarySlug);
  if (!preset) throw new Error(`Unknown library program: ${librarySlug}`);

  const slugs = [
    ...new Set(preset.days.flatMap((d) => d.items.map((i) => i.exerciseSlug))),
  ];
  const idBySlug = await resolveSystemExerciseIds(slugs);
  const missing = slugs.filter((s) => !idBySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Library exercises not seeded: ${missing.join(", ")}`);
  }

  return db.transaction(async (tx) => {
    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: preset.name,
      description: preset.description,
      librarySlug: preset.slug,
    });

    for (const [dayOrder, day] of preset.days.entries()) {
      const templateId = crypto.randomUUID();
      await tx.insert(schema.workoutTemplates).values({
        id: templateId,
        userId,
        name: day.name,
        programId,
        dayOrder,
        source: "manual",
      });
      if (day.items.length > 0) {
        await tx.insert(schema.templateExercises).values(
          day.items.map((it, i) => ({
            templateId,
            exerciseId: idBySlug.get(it.exerciseSlug)!,
            position: i,
            targetSets: it.targetSets,
            targetRepsMin: it.targetRepsMin,
            targetRepsMax: it.targetRepsMax,
            targetWeightKg: it.targetWeightKg,
            targetRestSeconds: it.targetRestSeconds,
          })),
        );
      }
    }

    return { id: programId };
  });
}

/** Записывает план, составленный ИИ-тренером, в строки пользователя: программа +
 *  по шаблону-дню на каждый день + их упражнения. exerciseSlug резолвятся в id
 *  СИСТЕМНЫХ упражнений (план уже отфильтрован санитайзером по каталогу, но на
 *  всякий случай дропаем не-резолвнутые). Программа активна сразу (составлена
 *  под клиента — без «полки»): дни тренируются со страницы программы, после
 *  первого прохода тренер адаптирует их на месте. Вес целевой = null (атлет
 *  подбирает на первой тренировке, как в библиотеке). */
export async function createAiProgramForUser(
  userId: string,
  plan: AiPlan,
): Promise<{ id: string }> {
  const slugs = [
    ...new Set(plan.days.flatMap((d) => d.items.map((i) => i.exerciseSlug))),
  ];
  const idBySlug = await resolveSystemExerciseIds(slugs);

  return db.transaction(async (tx) => {
    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: plan.name,
      description: plan.description || null,
      activatedAt: new Date(),
    });

    for (const [dayOrder, day] of plan.days.entries()) {
      const resolved = day.items.filter((it) => idBySlug.has(it.exerciseSlug));
      if (resolved.length === 0) continue; // день без резолвнутых упражнений — пропускаем

      const templateId = crypto.randomUUID();
      await tx.insert(schema.workoutTemplates).values({
        id: templateId,
        userId,
        name: day.name,
        description: day.focus || null,
        programId,
        dayOrder,
        source: "manual",
      });
      await tx.insert(schema.templateExercises).values(
        resolved.map((it, i) => ({
          templateId,
          exerciseId: idBySlug.get(it.exerciseSlug)!,
          position: i,
          targetSets: it.sets,
          targetRepsMin: it.repsMin,
          targetRepsMax: it.repsMax,
          targetWeightKg: null,
          targetRestSeconds: it.restSeconds,
          notes: it.note,
        })),
      );
    }

    return { id: programId };
  });
}

/** Обернуть свои шаблоны в тренировочную систему: создаёт программу и привязывает
 *  выбранные шаблоны как дни (в переданном порядке). Все шаблоны должны
 *  принадлежать пользователю (R-7) — иначе ошибка. */
export async function wrapTemplatesIntoProgram(
  userId: string,
  input: { name: string; description?: string | null; templateIds: string[] },
): Promise<{ id: string }> {
  if (input.templateIds.length === 0) {
    throw new Error("Нужен хотя бы один шаблон для системы");
  }
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: schema.workoutTemplates.id })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.userId, userId),
          inArray(schema.workoutTemplates.id, input.templateIds),
        ),
      );
    if (owned.length !== input.templateIds.length) {
      throw new Error("Some templates not found or not yours");
    }

    const programId = crypto.randomUUID();
    await tx.insert(schema.trainingPrograms).values({
      id: programId,
      userId,
      name: input.name,
      description: input.description ?? null,
      // Обёртка своих шаблонов — система активна сразу: эти шаблоны уже были в
      // «Шаблонах», обёртка не должна их прятать.
      activatedAt: new Date(),
    });

    // Порядок дней = порядок templateIds (источник истины — выбор пользователя).
    for (const [dayOrder, templateId] of input.templateIds.entries()) {
      await tx
        .update(schema.workoutTemplates)
        .set({ programId, dayOrder })
        .where(
          and(
            eq(schema.workoutTemplates.id, templateId),
            eq(schema.workoutTemplates.userId, userId),
          ),
        );
    }

    return { id: programId };
  });
}

export async function listPrograms(
  userId: string,
): Promise<ProgramListItem[]> {
  const rows = await db
    .select({
      id: schema.trainingPrograms.id,
      name: schema.trainingPrograms.name,
      librarySlug: schema.trainingPrograms.librarySlug,
      activatedAt: schema.trainingPrograms.activatedAt,
      updatedAt: schema.trainingPrograms.updatedAt,
      dayCount: count(schema.workoutTemplates.id),
    })
    .from(schema.trainingPrograms)
    .leftJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.programId, schema.trainingPrograms.id),
    )
    .where(
      and(
        eq(schema.trainingPrograms.userId, userId),
        isNull(schema.trainingPrograms.archivedAt),
      ),
    )
    .groupBy(schema.trainingPrograms.id)
    .orderBy(desc(schema.trainingPrograms.updatedAt));

  return rows.map(({ activatedAt, ...r }) => ({
    ...r,
    active: activatedAt != null,
  }));
}

export async function getProgramWithDays(
  userId: string,
  programId: string,
): Promise<ProgramWithDays | null> {
  const [program] = await db
    .select()
    .from(schema.trainingPrograms)
    .where(
      and(
        eq(schema.trainingPrograms.id, programId),
        eq(schema.trainingPrograms.userId, userId),
      ),
    )
    .limit(1);

  if (!program) return null;

  const rows = await db
    .select({
      templateId: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      dayOrder: schema.workoutTemplates.dayOrder,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
      exerciseCount: count(schema.templateExercises.id),
    })
    .from(schema.workoutTemplates)
    .leftJoin(
      schema.templateExercises,
      eq(schema.templateExercises.templateId, schema.workoutTemplates.id),
    )
    .where(eq(schema.workoutTemplates.programId, programId))
    .groupBy(schema.workoutTemplates.id)
    .orderBy(asc(schema.workoutTemplates.dayOrder));

  return {
    id: program.id,
    name: program.name,
    description: program.description,
    librarySlug: program.librarySlug,
    active: program.activatedAt != null,
    createdAt: program.createdAt,
    days: rows.map((r) => ({
      templateId: r.templateId,
      name: r.name,
      dayOrder: r.dayOrder,
      exerciseCount: r.exerciseCount,
      adapted: r.lastAdaptedWorkoutId != null,
    })),
    review: program.reviewJson ?? null,
    reviewedAt: program.reviewedAt,
  };
}

/** Собирает вход для оценки программы тренером: дни + упражнения (имя, целевые
 *  подходы/повторы) + группы мышц каждого упражнения. R-7: гейт по userId.
 *  null — программа не найдена / не принадлежит атлету. Пустые дни включаются
 *  (тренер отметит дыры). */
export async function getProgramForReview(
  userId: string,
  programId: string,
): Promise<ProgramReviewInput | null> {
  const [program] = await db
    .select({
      name: schema.trainingPrograms.name,
      description: schema.trainingPrograms.description,
    })
    .from(schema.trainingPrograms)
    .where(
      and(
        eq(schema.trainingPrograms.id, programId),
        eq(schema.trainingPrograms.userId, userId),
      ),
    )
    .limit(1);
  if (!program) return null;

  const dayRows = await db
    .select({
      templateId: schema.workoutTemplates.id,
      name: schema.workoutTemplates.name,
      dayOrder: schema.workoutTemplates.dayOrder,
    })
    .from(schema.workoutTemplates)
    .where(eq(schema.workoutTemplates.programId, programId))
    .orderBy(asc(schema.workoutTemplates.dayOrder));

  const dayIds = dayRows.map((d) => d.templateId);

  // Упражнения всех дней одним запросом (имя + целевые параметры), плюс группы
  // мышц. Затем раскладываем по дням в JS.
  const exerciseRows = dayIds.length
    ? await db
        .select({
          templateId: schema.templateExercises.templateId,
          position: schema.templateExercises.position,
          exerciseId: schema.templateExercises.exerciseId,
          nameRu: schema.exercises.nameRu,
          targetSets: schema.templateExercises.targetSets,
          targetRepsMin: schema.templateExercises.targetRepsMin,
          targetRepsMax: schema.templateExercises.targetRepsMax,
        })
        .from(schema.templateExercises)
        .innerJoin(
          schema.exercises,
          eq(schema.exercises.id, schema.templateExercises.exerciseId),
        )
        .where(inArray(schema.templateExercises.templateId, dayIds))
        .orderBy(asc(schema.templateExercises.position))
    : [];

  const exerciseIds = [...new Set(exerciseRows.map((e) => e.exerciseId))];
  const muscleRows = exerciseIds.length
    ? await db
        .select({
          exerciseId: schema.exerciseMuscleGroups.exerciseId,
          muscle: schema.exerciseMuscleGroups.muscleGroupKey,
          role: schema.exerciseMuscleGroups.role,
        })
        .from(schema.exerciseMuscleGroups)
        .where(inArray(schema.exerciseMuscleGroups.exerciseId, exerciseIds))
    : [];

  const musclesByExercise = new Map<
    string,
    { primary: string[]; secondary: string[] }
  >();
  for (const m of muscleRows) {
    const entry = musclesByExercise.get(m.exerciseId) ?? {
      primary: [],
      secondary: [],
    };
    if (m.role === "primary") entry.primary.push(m.muscle);
    else entry.secondary.push(m.muscle);
    musclesByExercise.set(m.exerciseId, entry);
  }

  return {
    name: program.name,
    description: program.description,
    days: dayRows.map((d) => ({
      name: d.name,
      exercises: exerciseRows
        .filter((e) => e.templateId === d.templateId)
        .map((e) => ({
          nameRu: e.nameRu,
          primaryMuscles: musclesByExercise.get(e.exerciseId)?.primary ?? [],
          secondaryMuscles: musclesByExercise.get(e.exerciseId)?.secondary ?? [],
          targetSets: e.targetSets,
          targetRepsMin: e.targetRepsMin,
          targetRepsMax: e.targetRepsMax,
        })),
    })),
  };
}

/** Кэширует оценку тренера в программу (review_json + reviewed_at). R-7. */
export async function saveProgramReview(
  userId: string,
  programId: string,
  review: ProgramReviewResult,
): Promise<void> {
  await db
    .update(schema.trainingPrograms)
    .set({ reviewJson: review, reviewedAt: new Date() })
    .where(
      and(
        eq(schema.trainingPrograms.id, programId),
        eq(schema.trainingPrograms.userId, userId),
      ),
    );
}

/** Удалить программу: дни-шаблоны отвязываются в standalone (не теряются),
 *  затем удаляется строка программы. SET NULL на FK сделал бы это сам, но
 *  чистим и dayOrder, чтобы не оставлять «висячий» порядок. */
export async function deleteProgram(
  userId: string,
  programId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.workoutTemplates)
      .set({ programId: null, dayOrder: null })
      .where(
        and(
          eq(schema.workoutTemplates.programId, programId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      );
    await tx
      .delete(schema.trainingPrograms)
      .where(
        and(
          eq(schema.trainingPrograms.id, programId),
          eq(schema.trainingPrograms.userId, userId),
        ),
      );
  });
}

/** Активировать / снять с активной систему: её дни-шаблоны появляются в общем
 *  списке «Шаблоны» (active=true) или прячутся обратно на полку Библиотеки
 *  (active=false). Сами шаблоны не трогаются — только видимость в /templates. */
export async function setProgramActive(
  userId: string,
  programId: string,
  active: boolean,
): Promise<void> {
  await db
    .update(schema.trainingPrograms)
    .set({ activatedAt: active ? new Date() : null })
    .where(
      and(
        eq(schema.trainingPrograms.id, programId),
        eq(schema.trainingPrograms.userId, userId),
      ),
    );
}

/** Текущие элементы шаблона-дня в форме доменной адаптации (без имён упражнений
 *  — для расчёта, не для показа). */
async function getTemplateAdaptItems(templateId: string): Promise<AdaptItem[]> {
  const rows = await db
    .select({
      exerciseId: schema.templateExercises.exerciseId,
      position: schema.templateExercises.position,
      targetSets: schema.templateExercises.targetSets,
      targetRepsMin: schema.templateExercises.targetRepsMin,
      targetRepsMax: schema.templateExercises.targetRepsMax,
      targetWeightKg: schema.templateExercises.targetWeightKg,
      targetRestSeconds: schema.templateExercises.targetRestSeconds,
      setScheme: schema.templateExercises.setScheme,
      myoMiniSets: schema.templateExercises.myoMiniSets,
      myoRepsPercent: schema.templateExercises.myoRepsPercent,
      myoRestSeconds: schema.templateExercises.myoRestSeconds,
      myoFirstRestSeconds: schema.templateExercises.myoFirstRestSeconds,
      notes: schema.templateExercises.notes,
    })
    .from(schema.templateExercises)
    .where(eq(schema.templateExercises.templateId, templateId))
    .orderBy(asc(schema.templateExercises.position));
  return rows;
}

/** Записывает адаптированные элементы в ТОТ ЖЕ шаблон (replace), ставит ключ
 *  идемпотентности lastAdaptedWorkoutId + adaptedAt и — РОВНО один раз, перед
 *  ПЕРВОЙ правкой — снимает снимок оригинала (preAdaptSnapshot) для отката
 *  («Отменить корректировку ИИ тренера»). Транзакция, проверка владения (R-7).
 *  Силовой шаблон любого вида: программный день или одиночный. */
export async function adaptTemplateInPlace(
  userId: string,
  templateId: string,
  items: AdaptItem[],
  workoutId: string,
  metadata: {
    summary: string;
    rationale: string;
    confidence: number;
    requiresConfirmation?: boolean;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({
        id: schema.workoutTemplates.id,
        preAdaptSnapshot: schema.workoutTemplates.preAdaptSnapshot,
      })
      .from(schema.workoutTemplates)
      .where(
        and(
          eq(schema.workoutTemplates.id, templateId),
          eq(schema.workoutTemplates.userId, userId),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Template not found or not yours");

    // Legacy, библиотечные и AI-шаблоны не всегда проходят через createTemplate.
    // Исходная версия должна появиться до первой автоматической замены строк.
    await createInitialTemplateVersion(tx, templateId);

    // Снимок оригинала — РОВНО один раз, ДО первой правки: то, к чему вернёт
    // откат. Снимаем текущие строки (их же сейчас и перезапишем). Повторная
    // адаптация снимок не трогает (snapshot остаётся undefined → не пишем).
    let snapshot: schema.PreAdaptSnapshotItem[] | undefined;
    if (owned.preAdaptSnapshot == null) {
      snapshot = await tx
        .select({
          exerciseId: schema.templateExercises.exerciseId,
          position: schema.templateExercises.position,
          targetSets: schema.templateExercises.targetSets,
          targetRepsMin: schema.templateExercises.targetRepsMin,
          targetRepsMax: schema.templateExercises.targetRepsMax,
          targetWeightKg: schema.templateExercises.targetWeightKg,
          targetRestSeconds: schema.templateExercises.targetRestSeconds,
          setScheme: schema.templateExercises.setScheme,
          myoMiniSets: schema.templateExercises.myoMiniSets,
          myoRepsPercent: schema.templateExercises.myoRepsPercent,
          myoRestSeconds: schema.templateExercises.myoRestSeconds,
          myoFirstRestSeconds: schema.templateExercises.myoFirstRestSeconds,
          notes: schema.templateExercises.notes,
        })
        .from(schema.templateExercises)
        .where(eq(schema.templateExercises.templateId, templateId))
        .orderBy(asc(schema.templateExercises.position));
    }

    await tx
      .delete(schema.templateExercises)
      .where(eq(schema.templateExercises.templateId, templateId));

    if (items.length > 0) {
      await tx.insert(schema.templateExercises).values(
        items.map((it, i) => ({
          templateId,
          exerciseId: it.exerciseId,
          position: i,
          targetSets: it.targetSets,
          targetRepsMin: it.targetRepsMin,
          targetRepsMax: it.targetRepsMax,
          targetWeightKg: it.targetWeightKg,
          targetRestSeconds: it.targetRestSeconds,
          setScheme: it.setScheme ?? "straight",
          myoMiniSets: it.myoMiniSets ?? DEFAULT_MYO_MINI_SETS,
          myoRepsPercent: it.myoRepsPercent ?? DEFAULT_MYO_REPS_PERCENT,
          myoRestSeconds: it.myoRestSeconds ?? DEFAULT_MYO_REST_SECONDS,
          myoFirstRestSeconds:
            it.myoFirstRestSeconds ?? DEFAULT_MYO_FIRST_REST_SECONDS,
          notes: it.notes ?? null,
        })),
      );
    }

    await tx
      .update(schema.workoutTemplates)
      .set({
        lastAdaptedWorkoutId: workoutId,
        adaptedAt: new Date(),
        ...(snapshot !== undefined ? { preAdaptSnapshot: snapshot } : {}),
      })
      .where(eq(schema.workoutTemplates.id, templateId));

    await appendTemplateVersion(tx, {
      templateId,
      source: "trainer",
      sourceWorkoutId: workoutId,
      summary: metadata.summary,
      rationale: metadata.rationale,
      confidence: metadata.confidence,
      requiresConfirmation: metadata.requiresConfirmation ?? false,
      confirmed: !(metadata.requiresConfirmation ?? false),
    });
  });
}

/** Силовой шаблон, по которому стартовала эта тренировка — программный ДЕНЬ ИЛИ
 *  одиночный шаблон (оба ставят workouts.templateId на старте), плюс маркеры
 *  адаптации. null — ad-hoc тренировка без шаблона: адаптировать нечего.
 *  R-7: гейт по userId. */
async function getTemplateBindingForWorkout(
  userId: string,
  workoutId: string,
): Promise<{
  templateId: string;
  lastAdaptedWorkoutId: string | null;
  adaptOptOut: boolean;
} | null> {
  const [row] = await db
    .select({
      templateId: schema.workoutTemplates.id,
      lastAdaptedWorkoutId: schema.workoutTemplates.lastAdaptedWorkoutId,
      adaptOptOut: schema.workoutTemplates.adaptOptOut,
    })
    .from(schema.workouts)
    .innerJoin(
      schema.workoutTemplates,
      eq(schema.workoutTemplates.id, schema.workouts.templateId),
    )
    .where(
      and(
        eq(schema.workouts.id, workoutId),
        eq(schema.workouts.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export type TemplateAdaptationResult = {
  /** true — шаблон адаптирован на месте сейчас (false — идемпотентный пропуск). */
  adapted: boolean;
  /** Сделанный свап упражнения (id→id) или null. */
  swap: { fromExerciseId: string; toExerciseId: string } | null;
  /** Число релевантных завершённых тренировок этого же шаблона. */
  relevantWorkoutCount: number;
};

async function loadTrendSessions(
  userId: string,
  templateId: string,
): Promise<TrendSession[]> {
  const rows = await db
    .select({ id: schema.workouts.id, startedAt: schema.workouts.startedAt })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.userId, userId),
        eq(schema.workouts.templateId, templateId),
        eq(schema.workouts.status, "completed"),
      ),
    )
    .orderBy(desc(schema.workouts.startedAt))
    .limit(10);
  if (rows.length === 0) return [];

  const notes = await db
    .select({
      workoutId: schema.workoutNotes.workoutId,
      content: schema.workoutNotes.content,
    })
    .from(schema.workoutNotes)
    .where(inArray(schema.workoutNotes.workoutId, rows.map((row) => row.id)));
  const feelingByWorkout = new Map<string, TrendSession["feeling"]>();
  for (const note of notes) {
    const content = note.content.toLocaleLowerCase("ru-RU");
    const feeling = content.includes("тяжело")
      ? "hard"
      : content.includes("легко")
        ? "easy"
        : content.includes("норм")
          ? "normal"
          : null;
    if (feeling) feelingByWorkout.set(note.workoutId, feeling);
  }

  const details = await Promise.all(
    rows.map((row) => getActiveWorkoutForUser(userId, row.id)),
  );
  return rows.flatMap((row, index) => {
    const detail = details[index];
    if (!detail) return [];
    return [
      {
        id: row.id,
        startedAt: row.startedAt,
        feeling: feelingByWorkout.get(row.id) ?? null,
        exercises: detail.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.sets.map((set) => ({
            weightKg: set.weightKg,
            reps: set.reps,
            rpe: set.rpe,
            restSeconds: set.restSeconds,
            setType: set.setType,
            myoRole: set.myoRole,
          })),
        })),
      },
    ];
  });
}

async function loadTrendLifeFactors(userId: string): Promise<TrendLifeFactors> {
  const [sleep, nutrition] = await Promise.all([
    db
      .select({
        hours: schema.sleepLogs.hours,
        quality: schema.sleepLogs.quality,
      })
      .from(schema.sleepLogs)
      .where(eq(schema.sleepLogs.userId, userId))
      .orderBy(desc(schema.sleepLogs.date))
      .limit(14),
    db
      .select({ kcal: schema.nutritionEntries.kcal })
      .from(schema.nutritionEntries)
      .where(eq(schema.nutritionEntries.userId, userId))
      .orderBy(desc(schema.nutritionEntries.date))
      .limit(14),
  ]);
  const calories = nutrition
    .map((row) => row.kcal)
    .filter((value): value is number => value != null);
  return {
    sleepHours: sleep.map((row) => row.hours),
    sleepQuality: sleep
      .map((row) => row.quality)
      .filter((value): value is number => value != null),
    nutritionDays: nutrition.length,
    averageCalories:
      calories.length > 0
        ? calories.reduce((sum, value) => sum + value, 0) / calories.length
        : null,
  };
}

async function loadEvidenceCitation(): Promise<string> {
  try {
    const { retrieveRelevant } = await import("@/lib/ai/rag/retrieve");
    const chunks = await retrieveRelevant(
      "resistance training progressive overload fatigue management RPE rest intervals",
      { topK: 2, minSimilarity: 0.35, domains: ["training"] },
    );
    const citations = [
      ...new Set(
        chunks.map((chunk) => {
          const author = chunk.sourceAuthor ? `${chunk.sourceAuthor}, ` : "";
          const page = chunk.page != null ? `, с. ${chunk.page}` : "";
          return `${author}«${chunk.sourceTitle}»${page}`;
        }),
      ),
    ];
    return citations.length > 0
      ? `Контекст литературы: ${citations.join("; ")}.`
      : "Релевантный фрагмент в загруженной базе знаний не найден.";
  } catch {
    return "База знаний недоступна; решение основано только на фактических логах.";
  }
}

/** Оркестратор адаптации СИЛОВОГО шаблона ПОСЛЕ завершённой тренировки — единый
 *  путь для программного дня И одиночного шаблона (оба ставят workouts.templateId
 *  на старте). Тренер правит ТОТ ЖЕ шаблон на месте: вес/повторы по факту, изредка
 *  свап застойного упражнения — корректировка сразу в «Шаблонах», готова к
 *  следующему старту (атлету не нужно лезть в прошлую тренировку и править руками).
 *  Возвращает null, когда адаптировать нечего: ad-hoc тренировка без шаблона ЛИБО
 *  шаблон с липким отказом (adaptOptOut — атлет откатил правки и не хочет их назад).
 *  Идемпотентно по lastAdaptedWorkoutId (повторный finish / офлайн-реплей = no-op).
 *  Снимок оригинала + adaptedAt ставит adaptTemplateInPlace. Свап — не более
 *  одного и только при подтверждённом застое (изредка). */
export async function adaptTemplateAfterWorkout(
  userId: string,
  workoutId: string,
): Promise<TemplateAdaptationResult | null> {
  const binding = await getTemplateBindingForWorkout(userId, workoutId);
  if (!binding) return null; // ad-hoc без шаблона → адаптировать нечего
  if (binding.adaptOptOut) return null; // липкий откат → тренер не лезет в шаблон

  // Идемпотентность: этот шаблон уже адаптирован по этой тренировке.
  if (binding.lastAdaptedWorkoutId === workoutId) {
    return { adapted: false, swap: null, relevantWorkoutCount: 0 };
  }
  const [existingVersion] = await db
    .select({ id: schema.templateVersions.id })
    .from(schema.templateVersions)
    .where(
      and(
        eq(schema.templateVersions.templateId, binding.templateId),
        eq(schema.templateVersions.sourceWorkoutId, workoutId),
      ),
    )
    .limit(1);
  if (existingVersion) {
    return { adapted: false, swap: null, relevantWorkoutCount: 0 };
  }

  const current = await getTemplateAdaptItems(binding.templateId);
  const [sessions, life] = await Promise.all([
    loadTrendSessions(userId, binding.templateId),
    loadTrendLifeFactors(userId),
  ]);
  const analysis = analyzeTemplateTrends({ current, sessions, life });
  if (!analysis.eligible) {
    return {
      adapted: false,
      swap: null,
      relevantWorkoutCount: analysis.relevantSessionCount,
    };
  }
  const citation = await loadEvidenceCitation();
  const rationale = `${analysis.rationale} ${citation}`;

  if (analysis.requiresConfirmation) {
    await db.transaction(async (tx) => {
      await createInitialTemplateVersion(tx, binding.templateId);
      await createPendingTemplateVersion(tx, {
        templateId: binding.templateId,
        source: "trainer",
        sourceWorkoutId: workoutId,
        snapshot: analysis.items.map((item) => ({
          ...item,
          notes: item.notes ?? null,
        })),
        summary: analysis.summary,
        rationale,
        confidence: analysis.confidence,
      });
    });
    return {
      adapted: false,
      swap: null,
      relevantWorkoutCount: analysis.relevantSessionCount,
    };
  }

  await adaptTemplateInPlace(
    userId,
    binding.templateId,
    analysis.items,
    workoutId,
    {
      summary: analysis.summary,
      rationale,
      confidence: analysis.confidence,
    },
  );
  return {
    adapted: true,
    swap: null,
    relevantWorkoutCount: analysis.relevantSessionCount,
  };
}
