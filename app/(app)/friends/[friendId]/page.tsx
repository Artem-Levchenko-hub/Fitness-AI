import { Activity, ChevronLeft, Dumbbell, Sparkles, Wand2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProfileAvatar } from "@/components/avatar/ProfileAvatar";
import {
  buildAvatarData,
  hasTrainingData,
} from "@/components/avatar/build-avatar-data";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  formatTemplateMeta,
  mergeTemplateList,
  sortTemplatesForFlow,
  type UnifiedTemplateItem,
} from "@/lib/domain";
import { formatFriendBodyLine } from "@/lib/domain/friends/friend-body";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { getFriendProfile } from "@/lib/repos/friends.repo";
import { muscleHeatProfile } from "@/lib/repos/stats.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import {
  listRecentWorkouts,
  listWorkoutScores,
  type RecentWorkout,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Тренировки друга" };

type Props = { params: Promise<{ friendId: string }> };

/** Имя для показа: name если есть, иначе email. */
function displayName(u: { name: string | null; email: string }): string {
  return u.name?.trim() || u.email;
}

export default async function FriendWorkoutsPage({ params }: Props) {
  const { friendId } = await params;
  const user = await requireUser();

  // R-7: запрашиваем данные друга ТОЛЬКО после подтверждения дружбы. Гейт выше
  // — дальше тот же паттерн прямого чтения по friendId, что и для тренировок.
  const friend = await getFriendProfile(user.id, friendId);
  if (!friend) notFound();

  const now = new Date();
  // Heat друга — РОВНО за areFriends-гейтом выше (R-7).
  const [workoutsRaw, heat] = await Promise.all([
    listRecentWorkouts(friendId, 30),
    muscleHeatProfile(friendId, now),
  ]);
  const workouts = workoutsRaw.filter((w) => w.status === "completed");

  // Шаблоны + оценки ИИ-тренера — ТОЛЬКО если друг включил «делиться»
  // (тренировки видны и без тумблера). Тот же прямой read по friendId за гейтом.
  let sharedTemplates: UnifiedTemplateItem[] = [];
  let scores = new Map<string, number>();
  if (friend.sharesPrograms) {
    const [strength, circuit, cardio] = await Promise.all([
      listTemplates(friendId),
      listCircuitTemplates(friendId),
      listCardioTemplates(friendId),
    ]);
    sharedTemplates = sortTemplatesForFlow(
      mergeTemplateList(strength, circuit, cardio),
    );
    scores = await listWorkoutScores(
      friendId,
      workouts.map((w) => w.id),
    );
  }

  // Аватар друга = тот же 3D-компонент, что на своём /profile, но read-only.
  // R-7: показываем НАГРЕВ групп друга, но НЕ его упражнения/рекорды — обнуляем
  // top3/records (тот же узкий объём данных, что нёс прежний силуэт сравнения).
  // Цели/недели/«забытость» не передаём (buildAvatarData без них → goalTarget
  // null, weeklyVolume []), панель остаётся read-only.
  const friendAvatarData = buildAvatarData(heat, now).map((d) => ({
    ...d,
    top3: [],
    records: [],
  }));
  const hasData = hasTrainingData(heat);
  const bodyLine = formatFriendBodyLine(friend.heightCm, friend.weightKg);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/friends">
          <ChevronLeft className="size-4" />
          Друзья
        </Link>
      </Button>

      <header className="mb-6 flex items-center gap-3">
        <div className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold">
          {displayName(friend).charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
            Только просмотр
          </p>
          <h1 className="font-serif mt-0.5 truncate text-2xl font-normal tracking-tight md:text-3xl">
            {displayName(friend)}
          </h1>
          {bodyLine ? (
            <p className="text-muted-foreground tabular mt-1 text-sm">
              {bodyLine}
            </p>
          ) : null}
        </div>
      </header>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          Мышцы за неделю
        </h2>
        {!hasData ? (
          <div className="border-border text-muted-foreground mb-3 rounded-2xl border border-dashed px-5 py-4 text-sm">
            У друга пока пусто — мышцы загорятся, когда он завершит тренировку.
          </div>
        ) : null}
        <ProfileAvatar data={friendAvatarData} />
        <p className="text-muted-foreground/70 mt-3 text-center text-xs leading-relaxed">
          Цвет мышцы — объём друга за 7 дней против его нормы: серый отдыхает,
          красный нагружен сильнее обычного. Покрути модель и нажми на группу.
        </p>
      </section>

      {friend.sharesPrograms && sharedTemplates.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Dumbbell className="text-muted-foreground size-4" aria-hidden="true" />
            Шаблоны друга
          </h2>
          <ul className="space-y-2">
            {sharedTemplates.map((tpl) => (
              <li
                key={`${tpl.format}-${tpl.id}`}
                className="bg-card border-border rounded-xl border p-4"
              >
                <FriendTemplateMeta tpl={tpl} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold tracking-tight">
        Последние тренировки
      </h2>

      {workouts.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <WorkoutRow workout={w} score={scores.get(w.id) ?? null} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Read-only мета шаблона друга — без ссылки (detail-роуты закрыты по userId).
 *  Бейдж «обновлён тренером» (R-41 иконка + текст). */
function FriendTemplateMeta({ tpl }: { tpl: UnifiedTemplateItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{tpl.name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {formatTemplateMeta(tpl)}
      </p>
      {tpl.adapted ? (
        <span className="text-primary mt-1 inline-flex items-center gap-1 text-[10px] font-medium">
          <Wand2 className="size-3" aria-hidden="true" />
          обновлён тренером
        </span>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
      <Activity className="size-7 opacity-60" aria-hidden="true" />
      <p className="text-sm">У друга пока нет завершённых тренировок.</p>
    </div>
  );
}

/** Read-only карточка тренировки друга — без ссылки (detail-роуты закрыты по
 *  userId), без действий. Дата · название · базовые KPI. Оценка ИИ-тренера
 *  (score 0..100) — бейджем, только если друг делится программами (иначе null). */
function WorkoutRow({
  workout,
  score,
}: {
  workout: RecentWorkout;
  score: number | null;
}) {
  const min = durationMinutes(workout.startedAt, workout.finishedAt);
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
          {formatShortDate(workout.startedAt)}
        </p>
        {score != null ? (
          <span className="bg-primary/10 text-primary inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
            <Sparkles className="size-3" aria-hidden="true" />
            Оценка ИИ {score}
          </span>
        ) : null}
      </div>
      <h3 className="mt-0.5 truncate text-base font-semibold tracking-tight">
        {workout.name}
      </h3>
      <dl className="text-muted-foreground tabular mt-3 grid grid-cols-3 gap-3 text-xs">
        <KPI label="подходов" value={String(workout.setCount)} />
        <KPI
          label="kg·reps"
          value={Math.round(workout.tonnageKg).toLocaleString("ru-RU")}
        />
        <KPI label="мин" value={min?.toString() ?? "—"} />
      </dl>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-foreground tabular text-sm font-semibold">{value}</p>
      <p className="mt-0.5">{label}</p>
    </div>
  );
}

function durationMinutes(
  startedAt: Date,
  finishedAt: Date | null,
): number | null {
  if (!finishedAt) return null;
  return Math.max(
    1,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}
