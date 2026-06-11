import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана одного упражнения (R-37). Мгновенный скелет при
 *  навигации /exercises → /exercises/[id], пока серверный компонент тянет
 *  упражнение (getExerciseById). Структура повторяет детальный экран: назад +
 *  заголовок (имя ru + en) + карточка мышц/описания + ряд edit/delete. Без
 *  своего loading.js Next показал бы скелет СПИСКА упражнений (родительский
 *  /exercises/loading.tsx: поиск + фильтр-чипы + сетка карточек) — не та форма
 *  для детального экрана (R-37: loading совпадает с контентом). */
export default function ExerciseDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-24 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-8 w-2/3 rounded-md md:h-9" />
          <Skeleton className="mt-2 h-4 w-1/3 rounded-md" />
        </header>

        <section className="bg-card border-border mb-4 space-y-4 rounded-2xl border p-5">
          <div>
            <Skeleton className="mb-2 h-3 w-28 rounded-md" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </div>

          <div>
            <Skeleton className="mb-2 h-3 w-24 rounded-md" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          </div>

          <div>
            <Skeleton className="mb-2 h-3 w-20 rounded-md" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
          </div>
        </section>

        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 flex-1 rounded-md" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка упражнения…
      </span>
    </main>
  );
}
