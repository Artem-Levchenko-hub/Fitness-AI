import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Plus,
  Settings2,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buildAvatarData } from "@/components/avatar/build-avatar-data";
import { Button } from "@/components/ui/button";
import { buildResumes } from "@/components/dashboard/active-resumes";
import { DashboardAvatarTile } from "@/components/dashboard/DashboardAvatarTile";
import { DashboardNavTile } from "@/components/dashboard/DashboardNavTile";
import { NutritionTile } from "@/components/dashboard/NutritionTile";
import { ResumeBanner } from "@/components/dashboard/ResumeBanner";
import { SleepTile } from "@/components/dashboard/SleepTile";
import { TodayScheduleCard } from "@/components/dashboard/TodayScheduleCard";
import { TrainerTrigger } from "@/components/dashboard/TrainerTrigger";
import { TrainerVoiceBanner } from "@/components/dashboard/TrainerVoiceBanner";
import { WeekStripPreview } from "@/components/dashboard/WeekStripPreview";
import {
  buildHistory,
  countWeekSessions,
  HistoryCard,
  LastSessionMini,
} from "@/components/workouts/workout-history";
import { requireUser } from "@/lib/auth/require-user";
import { isoWeekStartIso } from "@/lib/datetime/iso-week";
import { buildTrainerVoice } from "@/lib/ai/trainer-voice";
import { buildWeekStrip } from "@/lib/domain/stats/week-strip";
import { getUserProfile } from "@/lib/repos/body.repo";
import {
  getActiveCardioId,
  listRecentCardio,
} from "@/lib/repos/cardio.repo";
import { getActiveCircuitId, listCircuits } from "@/lib/repos/circuits.repo";
import {
  dailyVolume,
  muscleHeatProfile,
  workoutFrequency,
} from "@/lib/repos/stats.repo";
import {
  getActiveWorkoutId,
  getLatestPerWorkoutAnalysis,
  getLatestWeeklyReview,
  listRecentWorkouts,
} from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const name = user.name?.split(" ")[0] ?? user.email.split("@")[0];
  const now = new Date();

  // TZ юзера — границы недели/дня бакетятся РОВНО как на /stats и в истории
  // /workouts (G1). Фолбэк Europe/Moscow = TZ сервера.
  const profile = await getUserProfile(user.id);
  const tz = profile?.timezone ?? "Europe/Moscow";

  // H11.2 «голос тренера»: свежий per-workout разбор (≤7 дней) приоритетен,
  // недельный — fallback. Окно свежести — чтобы старый совет не висел вечно.
  const voiceSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    recent,
    activeId,
    recentCardio,
    activeCardioId,
    recentCircuits,
    activeCircuitId,
    heat,
    daily,
    frequency,
    latestAnalysis,
    weeklyReview,
  ] = await Promise.all([
    listRecentWorkouts(user.id, 30),
    getActiveWorkoutId(user.id),
    listRecentCardio(user.id, 10),
    getActiveCardioId(user.id),
    listCircuits(user.id, 10),
    getActiveCircuitId(user.id),
    muscleHeatProfile(user.id, now),
    // Те же источники, что рисуют графики /stats (силовые working-подходы,
    // бакет по TZ) → tile-превью совпадает со /stats (гейт H4.1). "30d"
    // покрывает текущую + прошлую ISO-неделю.
    dailyVolume(user.id, "30d", tz),
    workoutFrequency(user.id, "30d", tz),
    getLatestPerWorkoutAnalysis(user.id, voiceSince),
    getLatestWeeklyReview(user.id),
  ]);

  // Голос тренера: focus последнего разбора + ссылка на сам разбор. null →
  // секция не рендерится вовсе (анти-фантом R-37). Без нового AI-вызова.
  const trainerVoice = buildTrainerVoice(latestAnalysis, weeklyReview);

  // Понедельник текущей ISO-недели в TZ юзера — общая граница для week-strip
  // tile и честного счётчика WeekCard (тот же ключ, что группирует /workouts).
  const weekStartIso = isoWeekStartIso(now, tz);

  // Снимок «эта неделя» для tile-входа /stats (H4.1): 7 дней + тоннаж + дельта.
  const weekStrip = buildWeekStrip(daily, frequency, weekStartIso);

  // Мини-аватар витрины (H9.2): тот же heat-источник, что красит 3D на /profile;
  // здесь нужен только цвет/уровень/подходы по группам (без records/forgotten).
  const avatarData = buildAvatarData(heat, now);

  const completed = recent.filter((w) => w.status === "completed");
  // `last` = последняя СИЛОВАЯ — нужна для AI-тренера (анализирует силовые).
  const last = completed[0] ?? null;
  // Единый поток: «Недавние» и тайл «Последняя» сливают силовые + круговые +
  // кардио (как /workouts), а не показывают только силовые — иначе круговая/
  // кардио-сессия «пропадает» и форматы живут в разных мирах.
  const history = buildHistory(recent, recentCircuits, recentCardio);
  // «Эта неделя» = завершённые сессии ВСЕХ форматов за текущую ISO-неделю в TZ
  // юзера (H12.0). Раньше считались только силовые в серверной TZ — круговая/
  // кардио выпадали и граница недели врала вне TZ сервера.
  const weekCount = countWeekSessions(history, weekStartIso, tz);
  const recentHistory = history.slice(0, 3);
  const latestSession = history[0] ?? null;

  // Единый вход: один CTA «Начать тренировку» → /create (пикер формата) вместо
  // трёх формат-тайлов. Активные сессии любого формата — общий ResumeBanner.
  const resumes = buildResumes({ activeId, activeCircuitId, activeCardioId });

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-8">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          {greetingLabel(new Date())}
        </p>
        <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
          Привет, {name}
        </h1>
      </header>

      {resumes.length > 0 ? (
        <div className="mb-6 space-y-3">
          {resumes.map((r) => (
            <ResumeBanner
              key={r.href}
              href={r.href}
              label={r.label}
              cancel={r.cancel}
            />
          ))}
        </div>
      ) : null}

      {trainerVoice ? (
        <TrainerVoiceBanner
          focus={trainerVoice.focus}
          analysisId={trainerVoice.analysisId}
          href={trainerVoice.href}
        />
      ) : null}

      <TodayScheduleCard userId={user.id} />

      <StartCard />

      <section className="mt-6 grid grid-cols-2 gap-3">
        <WeekCard workouts={weekCount} />
        {latestSession ? (
          <LastSessionMini item={latestSession} />
        ) : (
          <EmptyMini />
        )}
      </section>

      {/* Бюджет компоновки (H9.1): входы «Статистика»/«Друзья» — один ряд
          компактных tile-вход, не отдельные секции. Тут же материализуются
          C1 (H4.1 week-strip /stats, H3.1 лента /friends). */}
      <section className="mt-3 grid grid-cols-2 gap-3">
        <DashboardNavTile href="/stats" label="Статистика" icon={BarChart3}>
          <WeekStripPreview strip={weekStrip} />
        </DashboardNavTile>
        <DashboardNavTile
          href="/friends"
          label="Друзья"
          icon={Users}
          hint="Лента и профили"
        />
      </section>

      {/* H9.2: мини-аватар-витрина — текущий heat-силуэт, тап → полный 3D на
          /profile. Крючок столпа 2 на главной, а не за вкладкой профиля. */}
      <section className="mt-3">
        <DashboardAvatarTile data={avatarData} />
      </section>

      <section className="mt-6 space-y-2">
        <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase">
          Восстановление
        </h2>
        <SleepTile userId={user.id} />
        <NutritionTile userId={user.id} />
      </section>

      <section className="mt-6">
        <TrainerTrigger lastWorkoutId={last?.id ?? null} />
      </section>

      {recentHistory.length > 0 ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-serif text-2xl font-normal tracking-tight">
              Недавние
            </h2>
            <Link
              href="/workouts"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase"
            >
              Все
              <ChevronRight className="size-3" />
            </Link>
          </div>
          <ul className="space-y-2">
            {recentHistory.map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <HistoryCard item={it} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function StartCard() {
  return (
    <section className="bg-card text-card-foreground border-border rounded-2xl border p-6">
      <h2 className="font-serif text-2xl font-normal tracking-tight">
        Готовы тренироваться?
      </h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Один вход для всех форматов — силовая, круговая, кардио и интервалы.
      </p>

      {/*
       * H12.2 item-c — один канонический вход «повторить»: «Начать тренировку»
       * → /create-пикер раскрывает шаблоны всех 3 форматов одним кликом (повтор
       * ≤2 тапа, столп 3). Вторая кнопка = УПРАВЛЕНИЕ (CRUD): /templates несёт
       * редактирование/создание/удаление — не дублирующий «запуск». Прежний
       * Dumbbell+«Мои шаблоны» читался как launch-аффорданс и плодил третий путь
       * к шаблонам рядом с /create; Settings2+«Управление шаблонами» развязывает
       * запуск и управление (столп 4 — запуск из /templates сохранён, но это уже
       * не входная точка повтора с дашборда).
       */}
      <div className="mt-5 flex flex-col gap-3">
        <Button asChild size="xl" className="w-full">
          <Link href="/create">
            <Plus className="size-5" />
            Начать тренировку
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href="/templates" data-testid="dashboard-manage-templates">
            <Settings2 className="size-5" />
            Управление шаблонами
          </Link>
        </Button>
      </div>
    </section>
  );
}

// «Эта неделя» — число завершённых сессий (всех форматов) недели. Тоннаж
// недели СОЗНАТЕЛЬНО НЕ показываем здесь (H4.3): он живёт ровно в одном
// носителе — week-strip превью tile «Статистика», чьи цифры по построению
// совпадают со /stats (dailyVolume). Прежний тоннаж WeekCard считался иначе
// (все форматы, локальная граница недели) и расходился со /stats — убран как
// дублирующий divergent-носитель. Ноль потери: тоннаж остаётся, теперь из
// канонического источника; число тренировок нигде не дублируется (столп 3+4).
function WeekCard({ workouts }: { workouts: number }) {
  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Эта неделя
      </p>
      <p
        data-testid="dashboard-week-count"
        className="font-serif tabular mt-1 text-3xl font-normal tracking-tight"
      >
        {workouts}
      </p>
      <p className="text-muted-foreground text-xs">
        {pluralize(workouts, "тренировка", "тренировки", "тренировок")}
      </p>
    </div>
  );
}

function EmptyMini() {
  return (
    <div className="bg-card border-border flex flex-col justify-between rounded-2xl border p-4">
      <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
        Первая тренировка
      </p>
      <p className="text-foreground mt-2 text-sm leading-relaxed">
        Откройте каталог упражнений или создайте шаблон.
      </p>
      <Link
        href="/exercises"
        className="text-primary mt-3 inline-flex items-center gap-1 text-xs font-medium"
      >
        Каталог
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

// --- helpers --- //

function pluralize(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function greetingLabel(d: Date): string {
  const h = d.getHours();
  if (h < 5) return "Ночью";
  if (h < 12) return "Утро";
  if (h < 17) return "День";
  if (h < 23) return "Вечер";
  return "Ночь";
}
