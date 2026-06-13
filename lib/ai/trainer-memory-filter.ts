import { and, eq, isNotNull, isNull, notExists, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";

type AiJobKindLiteral = (typeof schema.aiJobKind.enumValues)[number];

/** H11.1b (2-й под-слайс) — формат-фильтр «памяти тренера» по виду джоба.
 *
 *  Формат прошлого разбора определяется наличием workoutId/circuitWorkoutId:
 *  - circuit               = circuitWorkoutId есть;
 *  - strength (post/on_demand) = workoutId есть, circuit нет;
 *  - daily_digest          = оба null.
 *
 *  Ловушка: weekly_review хранится ТЕМ ЖЕ способом, что и digest (оба null —
 *  H8.2a), поэтому наивный digest-фильтр `isNull && isNull` молча тащит
 *  недельные разборы в память дайджеста (латентный шум с exec20). Отличаем по
 *  `ai_jobs.kind = 'weekly_review'` (FK ai_jobs.analysisId → ai_analyses.id):
 *  digest-ветка ДОПОЛНИТЕЛЬНО требует, чтобы у разбора НЕ было weekly-джоба
 *  (коррелированный NOT EXISTS). circuit/strength-ветки weekly не задевают —
 *  их фильтр требует NOT NULL workoutId/circuitWorkoutId, а у weekly оба null.
 *
 *  Чистая (R-07): импортирует только drizzle + схему-определения, НЕ db/client
 *  — юнит-тестируема через standalone QueryBuilder без подключения к БД. */
export function buildTrainerMemoryFilter(kind: AiJobKindLiteral) {
  const a = schema.aiAnalyses;

  if (kind === "circuit_post_workout") {
    return isNotNull(a.circuitWorkoutId);
  }

  if (kind === "daily_digest") {
    const j = schema.aiJobs;
    const weeklyForAnalysis = new QueryBuilder()
      .select({ one: sql`1` })
      .from(j)
      .where(and(eq(j.analysisId, a.id), eq(j.kind, "weekly_review")));
    return and(
      isNull(a.workoutId),
      isNull(a.circuitWorkoutId),
      notExists(weeklyForAnalysis),
    );
  }

  return and(isNotNull(a.workoutId), isNull(a.circuitWorkoutId));
}
