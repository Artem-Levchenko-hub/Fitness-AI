import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние /admin (R-37): кнопка «назад» + заголовок + 2 summary-
 *  карточки + список пользователей, пока сервер тянет listUsersOverview.
 *  Next 16: loading.tsx авто-оборачивает сегмент в <Suspense>. */
export default function AdminLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-9 w-52 md:h-10" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>

        <Skeleton className="mb-3 h-4 w-36" />
        <ul className="space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <li key={row}>
              <Skeleton className="h-28 w-full rounded-2xl" />
            </li>
          ))}
        </ul>
      </div>

      <span className="sr-only" role="status">
        Загрузка пользователей…
      </span>
    </main>
  );
}
