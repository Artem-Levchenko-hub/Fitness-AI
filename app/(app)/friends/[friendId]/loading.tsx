import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана тренировок друга (R-37). Мгновенный скелет при
 *  навигации /friends → /friends/[friendId], пока серверный компонент тянет
 *  профиль друга и его тренировки (getFriendProfile + listRecentWorkouts).
 *  Структура повторяет детальный экран: назад + шапка (аватар + «Только
 *  просмотр» + имя) + список read-only карточек тренировок (дата + название +
 *  3 KPI). Без своего loading.js Next показал бы скелет СПИСКА друзей
 *  (родительский /friends/loading.tsx: «Добавить друга» + список друзей) — не
 *  та форма для детального экрана (R-37: loading совпадает с контентом). */
export default function FriendWorkoutsLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-24 rounded-md" />

        <header className="mb-6 flex items-center gap-3">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="mt-1.5 h-8 w-44 rounded-md md:h-9" />
          </div>
        </header>

        <ul className="space-y-2">
          {[0, 1, 2].map((row) => (
            <li
              key={row}
              className="bg-card border-border rounded-2xl border p-4"
            >
              <Skeleton className="h-2.5 w-24 rounded-md" />
              <Skeleton className="mt-1 h-5 w-40 rounded-md" />
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[0, 1, 2].map((col) => (
                  <div key={col}>
                    <Skeleton className="h-5 w-10 rounded-md" />
                    <Skeleton className="mt-1 h-3 w-12 rounded-md" />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <span className="sr-only" role="status">
        Загрузка тренировок друга…
      </span>
    </main>
  );
}
