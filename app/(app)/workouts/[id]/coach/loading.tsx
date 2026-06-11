import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана AI-коуча /workouts/[id]/coach (R-37). Без своего
 *  loading.js ближайшая граница Suspense — родительский /workouts/[id]/loading.tsx
 *  = скелет ДЕТАЛЬНОГО просмотра тренировки (карточка-итог + блок разбора + список
 *  «Что делали»), а coach рисует ДРУГУЮ форму: «На главную» + eyebrow «После
 *  тренировки» + заголовок + 3-кол. сводка (подходов/kg·reps/минут) + секция
 *  «Поговорить с коучем» с чат-боксом (подсказка + поле ввода + кнопки). Этот
 *  скелет повторяет именно её (loading совпадает с контентом). Сам чат стримит
 *  свой «думает»-стейт уже ПОСЛЕ загрузки — скелет покрывает только окно
 *  серверного fetch (requireUser + getActiveWorkoutForUser). */
export default function CoachLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2 h-9 w-3/4 rounded-md" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-44" />
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <li key={i}>
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="mt-1.5 h-3 w-16" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <Skeleton className="mb-3 h-7 w-56" />

          <div className="space-y-4">
            <div className="bg-card border-border min-h-[180px] space-y-3 rounded-2xl border p-5">
              <Skeleton className="mx-auto size-10 rounded-full" />
              <Skeleton className="mx-auto h-3 w-3/4" />
              <Skeleton className="mx-auto h-3 w-2/3" />
            </div>

            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </section>

        <Skeleton className="mt-6 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-2/3" />
      </div>

      <span className="sr-only" role="status">
        Загрузка коуча…
      </span>
    </main>
  );
}
