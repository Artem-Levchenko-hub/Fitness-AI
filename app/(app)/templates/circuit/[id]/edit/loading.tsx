import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние редактора кругового шаблона (R-37, H14.5b). Скелет повторяет
 *  ФОРМУ CircuitBuilder: назад + заголовок + поле названия + ряд параметров круга
 *  (3 поля) + секция упражнений + кнопка «Добавить» + кнопка «Сохранить». */
export default function EditCircuitTemplateLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </header>

        <div className="space-y-6">
          {/* Название */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Параметры круга (кругов / паузы) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>

          {/* Упражнения */}
          <div>
            <Skeleton className="mb-3 h-4 w-28" />
            <ul className="space-y-3">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="bg-card border-border rounded-xl border p-3"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="mt-0.5 h-9 flex-1 rounded-md" />
                    <Skeleton className="size-8 shrink-0 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1].map((j) => (
                      <Skeleton key={j} className="h-9 rounded-md" />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Skeleton className="mt-3 h-11 w-full rounded-md" />
          </div>

          {/* Сохранить */}
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка редактора кругового шаблона…
      </span>
    </main>
  );
}
