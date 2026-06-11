import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние списка шаблонов (R-37). Мгновенный скелет при навигации
 *  на /templates, пока серверный компонент тянет список (listTemplates).
 *  Структура повторяет реальную страницу: заголовок «Шаблоны» + кнопка «Новый»
 *  + список карточек-шаблонов.
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function TemplatesLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-40 md:h-10" />
          <Skeleton className="h-11 w-24 rounded-md" />
        </header>

        <ul className="space-y-2">
          {[0, 1, 2, 3, 4].map((card) => (
            <li key={card}>
              <Skeleton className="h-[72px] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>

      <span className="sr-only" role="status">
        Загрузка шаблонов…
      </span>
    </main>
  );
}
