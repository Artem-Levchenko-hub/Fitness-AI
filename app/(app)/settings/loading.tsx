import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана «Профиль» (R-37). Мгновенный скелет при навигации
 *  на /settings, пока серверный компонент тянет профиль (getUserProfile).
 *  Структура повторяет реальную страницу: заголовок «Настройки / Профиль»
 *  + карточка с email/именем + карточка «Параметры тела» (форма)
 *  + карточка «Уведомления» + карточка «Связанные разделы» (ряд ссылок).
 *  Next 16: файл loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function SettingsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-9 w-32 md:h-10" />
        </header>

        <section className="bg-card border-border mb-6 space-y-3 rounded-2xl border p-5">
          <div>
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="mt-1.5 h-4 w-44" />
          </div>
          <div>
            <Skeleton className="h-2.5 w-10" />
            <Skeleton className="mt-1.5 h-4 w-28" />
          </div>
        </section>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <Skeleton className="mb-4 h-4 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-full rounded-md" />
            <Skeleton className="h-11 w-40 rounded-md" />
          </div>
        </section>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <Skeleton className="mb-4 h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-md" />
        </section>

        <section className="bg-card border-border mb-6 rounded-2xl border p-5">
          <Skeleton className="mb-3 h-4 w-36" />
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <Skeleton key={row} className="h-11 w-full rounded-md" />
            ))}
          </div>
        </section>
      </div>

      <span className="sr-only" role="status">
        Загрузка профиля…
      </span>
    </main>
  );
}
