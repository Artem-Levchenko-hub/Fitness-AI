import { localDateIso } from "@/lib/datetime/local-day";
import { summarizeQuickDay } from "@/lib/domain/quick-activity/summary";
import { listExercises } from "@/lib/repos/exercises.repo";
import {
  listQuickActivityForDay,
  listRecentQuickExercises,
} from "@/lib/repos/quick-activity.repo";

import { QuickActivityCard } from "./QuickActivityCard";

/** Серверный тайл «Доп. активность» на дашборде: сводка «сегодня» + данные для
 *  клиентского шита (чипы последних упражнений, каталог для пикера). Быстрый
 *  лог подхода между делом БЕЗ создания тренировки — данные утекают в /stats,
 *  нагрев аватара и недельный AI-разбор (см. stats.repo). */
export async function QuickActivityTile({
  userId,
  tz,
}: {
  userId: string;
  tz: string;
}) {
  const today = localDateIso(new Date(), tz);
  const [entries, recent, exercises] = await Promise.all([
    listQuickActivityForDay(userId, today, tz),
    listRecentQuickExercises(userId, 3),
    listExercises(userId),
  ]);

  const summary = summarizeQuickDay(
    entries.map((e) => ({
      exerciseName: e.exerciseName,
      mode: e.mode,
      reps: e.reps,
    })),
  );

  return (
    <QuickActivityCard
      summary={summary}
      todayEntries={entries.map((e) => ({
        id: e.id,
        exerciseName: e.exerciseName,
        mode: e.mode,
        reps: e.reps,
        weightKg: e.weightKg,
      }))}
      recent={recent}
      exercises={exercises.map((ex) => ({
        id: ex.id,
        nameRu: ex.nameRu,
        nameEn: ex.nameEn,
        isCustom: ex.isCustom,
      }))}
    />
  );
}
