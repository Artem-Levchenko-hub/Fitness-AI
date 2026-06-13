import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние редактора кардио-шаблона (R-37, H14.5c). Скелет повторяет
 *  ФОРМУ CardioEditForm: назад + заголовок + поле названия + ряд параметров. */
export default function EditCardioTemplateLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </header>

        <div className="space-y-6">
          {/* Название */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-11 w-full rounded-md" />
          </div>

          {/* Параметры пресета */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>

          {/* Сохранить */}
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка редактора кардио-шаблона…
      </span>
    </main>
  );
}
