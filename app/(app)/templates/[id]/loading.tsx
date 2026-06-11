import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана одного шаблона (R-37). Мгновенный скелет при
 *  навигации /templates → /templates/[id], пока серверный компонент тянет
 *  шаблон с упражнениями (getTemplateWithItems). Структура повторяет детальный
 *  экран: назад + заголовок + крупная кнопка «Начать тренировку» + список
 *  упражнений + ряд edit/delete. Без своего loading.js Next показал бы скелет
 *  СПИСКА шаблонов (родительский /templates/loading.tsx) — не та форма для
 *  детального экрана (R-37: loading совпадает с контентом). */
export default function TemplateDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-5">
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </header>

        <Skeleton className="mb-6 h-14 w-full rounded-xl" />

        <ol className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="bg-card border-border flex items-start gap-3 rounded-xl border p-4"
            >
              <Skeleton className="mt-0.5 size-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-2/3" />
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 flex-1 rounded-md" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка шаблона…
      </span>
    </main>
  );
}
