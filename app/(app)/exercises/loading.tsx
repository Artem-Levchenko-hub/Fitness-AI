import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние библиотеки упражнений (R-37). Мгновенный скелет при
 *  навигации на /exercises, пока серверный компонент тянет список упражнений
 *  (listExercises). Структура повторяет реальную страницу: заголовок + кнопка
 *  «Своё» + поиск + ряд фильтр-чипов + три вкладки + список карточек.
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function ExercisesLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-44 md:h-10" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </header>

        <div className="space-y-4">
          {/* Поиск */}
          <Skeleton className="h-9 w-full rounded-md" />

          {/* Фильтр-чипы по группам мышц */}
          <div className="flex gap-1.5 overflow-hidden">
            {[0, 1, 2, 3, 4, 5].map((chip) => (
              <Skeleton key={chip} className="h-7 w-16 shrink-0 rounded-full" />
            ))}
          </div>

          {/* Вкладки Все / Системные / Мои */}
          <Skeleton className="h-9 w-full rounded-md" />

          {/* Карточки упражнений */}
          <ul className="space-y-2">
            {[0, 1, 2, 3, 4].map((card) => (
              <li key={card}>
                <Skeleton className="h-[92px] w-full rounded-xl" />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка упражнений…
      </span>
    </main>
  );
}
