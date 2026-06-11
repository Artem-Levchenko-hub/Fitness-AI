import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана «КБЖУ» (R-37). Мгновенный скелет при навигации
 *  на /nutrition, пока серверный компонент тянет данные за сегодня
 *  (getNutritionForDate) и последние 7 дней (listRecentNutrition).
 *  Структура повторяет реальную страницу: кнопка «назад» + заголовок
 *  «Питание / КБЖУ сегодня» + карточка-форма (калории/Б/Ж/У/заметка)
 *  + список «Последние 7 дней».
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function NutritionLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-8 w-28" />

        <header className="mb-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-52" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
          <Skeleton className="mt-1.5 h-4 w-2/3" />
        </header>

        <section className="bg-card border-border mb-8 rounded-2xl border p-6">
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-11 w-40 rounded-md" />
          </div>
        </section>

        <section>
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="bg-card border-border divide-border divide-y rounded-2xl border">
            {[0, 1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="flex items-center justify-between px-4 py-3"
              >
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка данных питания…
      </span>
    </main>
  );
}
