import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние единого потока тренировок (R-37). Мгновенный скелет при
 *  навигации на /workouts, пока серверный компонент тянет историю всех форматов
 *  (силовые + круговые + кардио). Структура повторяет реальную страницу:
 *  заголовок + недельные группы карточек. */
export default function WorkoutsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          История
        </p>
        <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight md:text-5xl">
          Тренировки
        </h1>
      </header>

      <div className="space-y-8" aria-hidden="true">
        {[0, 1].map((group) => (
          <section key={group}>
            <Skeleton className="mb-3 ml-1 h-3 w-24" />
            <ul className="space-y-2">
              {[0, 1, 2].map((row) => (
                <li key={row}>
                  <Skeleton className="h-[88px] w-full rounded-2xl" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <span className="sr-only" role="status">
        Загрузка истории тренировок…
      </span>
    </main>
  );
}
