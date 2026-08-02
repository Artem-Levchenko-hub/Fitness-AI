import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана «Баланс» (R-37). Мгновенный скелет при навигации
 *  на /billing, пока серверный компонент параллельно тянет баланс, операции,
 *  подписку и, при возврате из ЮKassa, платёж.
 *  Показываем только заголовок и первичную секцию подписки: активное и
 *  неактивное состояния сильно отличаются по высоте, поэтому баланс и
 *  остальные нижние секции появляются уже после определения варианта.
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function BillingLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-8 w-28 md:h-9" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-40" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <div className="bg-muted mt-4 space-y-2 rounded-xl px-4 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка баланса…
      </span>
    </main>
  );
}
