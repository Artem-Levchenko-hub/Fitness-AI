import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние экрана одной круговой (R-37). Мгновенный скелет при
 *  навигации на /circuits/[id] из единого потока /workouts (HistoryCard ведёт
 *  круговую сюда), пока серверный компонент тянет круговую + AI-разбор.
 *  Структура повторяет завершённую круговую (главный путь из истории —
 *  CompletedCircuit): назад + заголовок + карточка-итог (3 стата) + блок
 *  разбора + «Упражнения». Родительский /circuits/page.tsx — redirect (нет
 *  своего loading.tsx) → без этого файла Next не показал бы никакого скелета,
 *  а заморозил предыдущий экран до прихода данных. */
export default function CircuitDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 -ml-3 h-8 w-28 rounded-md" />

        <header className="mb-6">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-1 h-9 w-3/4 rounded-md" />
        </header>

        <div className="space-y-5">
          <section className="bg-card border-border rounded-2xl border p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-0.5 size-9 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-44" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-8 w-12" />
                      <Skeleton className="mt-1.5 h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-card border-border rounded-2xl border p-5">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="mt-1.5 h-3 w-5/6" />
          </section>

          <section className="bg-card border-border rounded-2xl border p-4">
            <Skeleton className="mb-3 h-4 w-28" />
            <ul className="space-y-3">
              {[0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="border-border border-b pb-3 last:border-b-0 last:pb-0"
                >
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="mt-2 h-3 w-1/3" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <span className="sr-only" role="status">
        Загрузка круговой…
      </span>
    </main>
  );
}
