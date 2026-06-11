import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана «Тело» (R-37). Мгновенный скелет при навигации
 *  на /body, пока серверный компонент тянет 2 источника в Promise.all
 *  (getUserProfile + listMeasurements 60) и считает BMI/LBM.
 *  Структура повторяет реальную страницу: заголовок «Композиция и обхваты / Тело»
 *  + карточка «Последний замер» (сетка из 3 колонок) + карточка «Новый замер»
 *  + список «История».
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function BodyLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2 h-9 w-24 md:h-10" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <Skeleton className="h-3 w-48" />
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((cell) => (
              <div key={cell}>
                <Skeleton className="h-2.5 w-12" />
                <Skeleton className="mt-1.5 h-6 w-16" />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border-border mb-8 rounded-2xl border p-5">
          <Skeleton className="mb-4 h-4 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-40 rounded-md" />
          </div>
        </section>

        <section>
          <Skeleton className="mb-3 h-4 w-24" />
          <ul className="bg-card border-border divide-border divide-y rounded-xl border">
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="px-4 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1.5 h-3 w-48" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка данных о теле…
      </span>
    </main>
  );
}
