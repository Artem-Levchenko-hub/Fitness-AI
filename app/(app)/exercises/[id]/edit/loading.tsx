import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние редактора упражнения (R-37). Мгновенный скелет при навигации
 *  /exercises/[id] → /exercises/[id]/edit, пока серверный компонент тянет упражнение
 *  (getExerciseById). Структура повторяет ФОРМУ (ExerciseForm): назад + заголовок +
 *  поле «Название (рус)» + «Название (англ)» + «Описание» + две секции выбора групп
 *  мышц (основные / вторичные, сетка чипов) + кнопка «Сохранить». Без своего
 *  loading.js Next показал бы родительский /exercises/[id]/loading.tsx = детальный
 *  скелет ПРОСМОТРА (карточка мышц + edit/delete) — не та форма для редактора
 *  (R-37: loading совпадает с контентом). */
export default function EditExerciseLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-9 w-2/3 rounded-md" />
        </header>

        <div className="space-y-6">
          {/* Название (рус) */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Название (англ) */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>

          {/* Основные группы мышц */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-3/4" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Вторичные группы мышц */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-3 w-3/4" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Сохранить */}
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-14 flex-1 rounded-md" />
          </div>
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка редактора упражнения…
      </span>
    </main>
  );
}
