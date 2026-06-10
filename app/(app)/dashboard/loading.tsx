import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние главной (R-37). Мгновенный скелет при навигации на
 *  /dashboard, пока серверный компонент тянет недавние тренировки, активные
 *  сессии и тайлы восстановления (несколько запросов в Promise.all). Структура
 *  повторяет реальную страницу: приветствие + старт-карточка + сетка недели +
 *  блок восстановления + недавние. */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-8">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-10 w-56" />
        </header>

        {/* Старт-карточка: заголовок + два CTA */}
        <section className="bg-card border-border rounded-2xl border p-6">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="mt-3 h-4 w-full max-w-xs" />
          <div className="mt-5 flex flex-col gap-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </section>

        {/* Неделя + последняя сессия */}
        <section className="mt-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </section>

        {/* Восстановление */}
        <section className="mt-6 space-y-2">
          <Skeleton className="mb-2 ml-1 h-3 w-28" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </section>

        {/* Недавние */}
        <section className="mt-8">
          <Skeleton className="mb-3 ml-1 h-6 w-32" />
          <ul className="space-y-2">
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <Skeleton className="h-[88px] w-full rounded-2xl" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка главной…
      </span>
    </main>
  );
}
