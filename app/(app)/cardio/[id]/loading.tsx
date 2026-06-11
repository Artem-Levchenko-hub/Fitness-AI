import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана одной кардио-сессии (R-37). Мгновенный скелет при
 *  навигации на /cardio/[id] из единого потока /workouts (HistoryCard ведёт
 *  кардио сюда), пока серверный компонент тянет сессию (getCardioForUser).
 *  Структура повторяет завершённую кардио (главный путь из истории —
 *  CompletedCardio): назад + заголовок + карточка-итог (3 стата) + «Блоки».
 *  Без блока AI-разбора — у кардио нет ai_analyses. Родительский
 *  /cardio/page.tsx — redirect (нет своего loading.tsx) → без этого файла Next
 *  не показал бы никакого скелета, а заморозил предыдущий экран до данных. */
export default function CardioDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-1 h-9 w-3/4 rounded-md" />
        </header>

        <div className="space-y-5">
          <section className="bg-card border-border rounded-2xl border p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 size-9 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-8 w-12" />
                      <Skeleton className="mt-1.5 h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-card border-border rounded-2xl border p-4">
            <Skeleton className="mb-3 h-4 w-20" />
            <ul className="space-y-2">
              {[0, 1, 2, 3].map((row) => (
                <li key={row} className="flex items-center gap-3">
                  <Skeleton className="size-6 shrink-0 rounded-md" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-12" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка кардио…
      </span>
    </main>
  );
}
