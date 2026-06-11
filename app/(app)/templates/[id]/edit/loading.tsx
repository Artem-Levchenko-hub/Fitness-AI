import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние редактора шаблона (R-37). Мгновенный скелет при навигации
 *  /templates/[id] → /templates/[id]/edit, пока серверный компонент тянет шаблон
 *  и список упражнений (getTemplateWithItems + listExercises). Структура повторяет
 *  ФОРМУ-конструктор (TemplateBuilder): назад + заголовок + поле названия +
 *  описание + секция упражнений с карточками-рядами + кнопка «Добавить» + кнопка
 *  «Сохранить». Без своего loading.js Next показал бы родительский
 *  /templates/[id]/loading.tsx = детальный скелет ПРОСМОТРА шаблона (крупная
 *  кнопка «Начать тренировку» + список + edit/delete) — не та форма для редактора
 *  (R-37: loading совпадает с контентом). */
export default function EditTemplateLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-24 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </header>

        <div className="space-y-6">
          {/* Название */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          {/* Упражнения */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-6" />
            </div>

            <ul className="space-y-3">
              {[0, 1].map((i) => (
                <li
                  key={i}
                  className="bg-card border-border rounded-2xl border p-4"
                >
                  <div className="mb-3 flex items-start gap-2">
                    <Skeleton className="size-5 shrink-0 rounded" />
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="mt-0.5 h-4 w-40 flex-1" />
                    <Skeleton className="size-6 shrink-0 rounded" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((j) => (
                      <Skeleton key={j} className="h-9 rounded-md" />
                    ))}
                  </div>
                </li>
              ))}
            </ul>

            <Skeleton className="mt-3 h-11 w-full rounded-md" />
          </div>

          {/* Сохранить */}
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка редактора шаблона…
      </span>
    </main>
  );
}
