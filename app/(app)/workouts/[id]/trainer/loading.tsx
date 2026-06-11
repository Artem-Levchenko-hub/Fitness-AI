import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана AI-разбора /workouts/[id]/trainer (R-37). Без своего
 *  loading.js ближайшая граница Suspense — родительский /workouts/[id]/loading.tsx
 *  = скелет ДЕТАЛЬНОГО просмотра тренировки (карточка-итог + блок разбора + список
 *  «Что делали»), а trainer рисует ДРУГУЮ форму: «На главную» + eyebrow «После
 *  тренировки» + заголовок + 3-кол. сводка (подходов/kg·reps/минут) + карточка
 *  разбора, БЕЗ списка упражнений. Этот скелет повторяет именно её (loading
 *  совпадает с контентом). Сам стрим/поллинг AI рисует свой «думает»-стейт уже
 *  ПОСЛЕ загрузки — этот скелет покрывает только окно серверного fetch. */
export default function TrainerLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2 h-9 w-3/4 rounded-md" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <ul className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-8 w-14" />
                <Skeleton className="mt-1.5 h-3 w-16" />
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-5/6" />
              <Skeleton className="mt-1.5 h-3 w-4/6" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </section>

        <Skeleton className="mt-6 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-2/3" />
      </div>

      <span className="sr-only" role="status">
        Загрузка разбора…
      </span>
    </main>
  );
}
