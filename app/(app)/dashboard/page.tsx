import {
  ArrowRight,
  Dumbbell,
  Plus,
  Settings2,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DashboardNavTile } from "@/components/dashboard/DashboardNavTile";
import { FriendsActivityPreview } from "@/components/dashboard/FriendsActivityPreview";
import { NutritionTile } from "@/components/dashboard/NutritionTile";
import { QuickActivityTile } from "@/components/dashboard/QuickActivityTile";
import { SleepTile } from "@/components/dashboard/SleepTile";
import { TodayScheduleCard } from "@/components/dashboard/TodayScheduleCard";
import { TrainerTrigger } from "@/components/dashboard/TrainerTrigger";
import {
  buildHistory,
  countWeekSessions,
  LastSessionMini,
} from "@/components/workouts/workout-history";
import { requireUser } from "@/lib/auth/require-user";
import { isoWeekStartIso } from "@/lib/datetime/iso-week";
import { selectTopFriendActivity } from "@/lib/domain/friends/friend-activity";
import { getUserProfile } from "@/lib/repos/body.repo";
import { listFriendsActivity } from "@/lib/repos/friends.repo";
import { listRecentCardio } from "@/lib/repos/cardio.repo";
import { listCircuits } from "@/lib/repos/circuits.repo";
import { listRecentWorkouts } from "@/lib/repos/workouts.repo";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const name = user.name?.split(" ")[0] ?? user.email.split("@")[0];
  const now = new Date();

  // TZ юзера — границы недели/дня бакетятся РОВНО как на /stats и в истории
  // /workouts (G1). Фолбэк Europe/Moscow = TZ сервера.
  const profile = await getUserProfile(user.id);
  const tz = profile?.timezone ?? "Europe/Moscow";

  const [recent, recentCardio, recentCircuits, friendsActivity] = await Promise.all([
    listRecentWorkouts(user.id, 30),
    listRecentCardio(user.id, 10),
    listCircuits(user.id, 10),
    // Лента активности друзей — тот же источник, что /friends (H3.2). Превью
    // тайла берёт ровно её топ, чтобы строка не разошлась с верхней карточкой.
    listFriendsActivity(user.id),
  ]);

  // Граница ISO-недели для счётчика совпадает с группировкой в «Тренировках».
  const weekStartIso = isoWeekStartIso(now, tz);

  // Для разбора тренеру нужна последняя силовая сессия.
  const last = recent.find((workout) => workout.status === "completed");
  const history = buildHistory(recent, recentCircuits, recentCardio);
  const weekCount = countWeekSessions(history, weekStartIso, tz);
  const latestSession = history[0] ?? null;

  // Превью тайла «Друзья» (H3.1): самое свежее событие среди всех друзей,
  // выбранное ТЕМ ЖЕ модулем, что лента /friends (H3.2) — null при 0 друзей /
  // 0 событий, тогда тайл показывает свой hint как раньше (R-37).
  const topFriendActivity = selectTopFriendActivity(friendsActivity);

  // Единый вход: один CTA «Начать тренировку» → /create (пикер формата) вместо
  // трёх формат-тайлов. Возобновление активной сессии любого формата — теперь
  // ГЛОБАЛЬНАЯ полоса (GlobalResumeBar в (app)/layout), видна с любого экрана
  // (H12.4): один носитель вместо page-level баннеров на /dashboard и /workouts.
  return (
    <main
      oai-annotation-container=""
      className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10"
    >
      <header oai-annotatable="Приветствие" className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium capitalize">
            {new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(now)}
          </p>
          <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
            Привет, {name}
          </h1>
        </div>
        <Link href="/settings" aria-label="Настройки" className="bg-card border-border text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full border">
          <Settings className="size-5" aria-hidden="true" />
        </Link>
      </header>

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

      <div className="mt-3">
        <DashboardNavTile
          href="/friends"
          label="Друзья"
          icon={Users}
          hint="Лента и профили"
        >
          {topFriendActivity ? (
            <FriendsActivityPreview activity={topFriendActivity} />
          ) : null}
        </DashboardNavTile>
      </div>

      {/* Доп. активность — быстрый лог подхода/тотала между делом без создания
          тренировки; учитывается в /stats, нагреве аватара и недельном разборе. */}
      <section oai-annotatable="Дополнительная активность" className="mt-3">
        <QuickActivityTile userId={user.id} tz={tz} />
      </section>

      <section oai-annotatable="Восстановление" className="mt-6 space-y-2">
        <h2 className="text-muted-foreground mb-2 px-1 text-xs font-medium tracking-wide uppercase">
          Восстановление
        </h2>
        <SleepTile userId={user.id} timeZone={tz} />
        <NutritionTile userId={user.id} timeZone={tz} />
      </section>

      <section oai-annotatable="Спросить тренера" className="mt-6">
        <TrainerTrigger lastWorkoutId={last?.id ?? null} />
      </section>
    </main>
  );
}

function StartCard() {
  return (
    <section
      oai-annotatable="Время тренироваться"
      className="overflow-hidden rounded-3xl bg-[#294b38] p-5 text-[#fcfbf4] sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[1.75rem] leading-tight font-normal tracking-tight sm:text-3xl">Время тренироваться</h2>
          <p className="mt-2 max-w-64 text-sm leading-relaxed text-[#e1eadc]">Выбери готовый план или начни свою тренировку.</p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <Dumbbell className="size-6" aria-hidden="true" />
        </span>
      </div>

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
      <Button asChild size="xl" className="w-full rounded-2xl bg-[#e5eddc] text-[#213a2c] hover:bg-white">
        <Link href="/create"><Plus className="size-5" />Начать тренировку<ArrowRight className="ml-auto size-5" /></Link>
      </Button>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button asChild variant="ghost" className="h-auto min-h-12 justify-start whitespace-normal rounded-xl px-2 text-xs text-[#e1eadc] hover:bg-white/10 hover:text-white">
          <Link href="/programs/ai" data-testid="dashboard-ai-plan">
            <Sparkles className="size-4" />
            План с AI-тренером
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto min-h-12 justify-end whitespace-normal rounded-xl px-2 text-xs text-[#e1eadc] hover:bg-white/10 hover:text-white">
          <Link href="/templates" data-testid="dashboard-manage-templates">
            <Settings2 className="size-4" />
            Мои шаблоны
          </Link>
        </Button>
      </div>
    </section>
  );
}

// «Эта неделя» считает завершённые тренировки всех форматов.
function WeekCard({ workouts }: { workouts: number }) {
  return (
    <div oai-annotatable="Эта неделя" className="bg-card border-border rounded-2xl border p-4">
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
    <div oai-annotatable="Первая тренировка" className="bg-card border-border flex flex-col justify-between rounded-2xl border p-4">
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
