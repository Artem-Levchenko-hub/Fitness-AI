import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана расписаний (R-37). Мгновенный скелет при навигации
 *  на /schedule, пока серверный компонент тянет 4 источника в Promise.all
 *  (listSchedules, listTemplates, listCircuits, listRecentCardio).
 *  Структура повторяет реальную страницу: кнопка «назад» + заголовок
 *  «Напоминания / Расписание тренировок» + карточка «Новое расписание»
 *  + список «Ваши расписания».
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function ScheduleLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-9 w-72 md:h-10" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
        </header>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-32 rounded-md" />
          </div>
        </section>

        <section>
          <Skeleton className="mb-3 h-4 w-36" />
          <ul className="space-y-3">
            {[0, 1, 2].map((row) => (
              <li key={row}>
                <Skeleton className="h-[76px] w-full rounded-2xl" />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка расписаний…
      </span>
    </main>
  );
}
