import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана «Баланс» (R-37). Мгновенный скелет при навигации
 *  на /billing, пока серверный компонент тянет 2 источника в Promise.all
 *  (getOrCreateBalance + listTransactions 12).
 *  Структура повторяет реальную страницу: заголовок «Кошелёк / Баланс»
 *  + карточка «Доступно» (иконка + сумма) + секция «Пополнить» (форма)
 *  + список «История операций».
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function BillingLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-32 md:h-10" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-11 shrink-0 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-1.5 h-9 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
          </div>
        </section>

        <section className="mb-8">
          <Skeleton className="mb-3 h-4 w-24" />
          <div className="bg-card border-border space-y-3 rounded-2xl border p-5">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-40 rounded-md" />
          </div>
        </section>

        <section>
          <Skeleton className="mb-3 h-4 w-36" />
          <ul className="bg-card border-border divide-border divide-y rounded-xl border">
            {[0, 1, 2, 3, 4].map((row) => (
              <li
                key={row}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка баланса…
      </span>
    </main>
  );
}
