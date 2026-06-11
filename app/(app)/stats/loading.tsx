import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние статистики (R-37). Мгновенный скелет при навигации на
 *  /stats, пока серверный компонент тянет KPI, объём, группы мышц, диапазоны
 *  повторений, частоту, e1RM-тренд и измерения (9+ запросов в Promise.all).
 *  Структура повторяет реальную страницу: заголовок + период-пиллы + карточка-
 *  инсайт + сетка KPI + шесть карточек-графиков. */
export default function StatsLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <header className="mb-6">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-9 w-48 md:h-10" />
        </header>

        {/* Период-пиллы */}
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4].map((pill) => (
            <Skeleton key={pill} className="h-9 w-16 rounded-full" />
          ))}
        </div>

        {/* Карточка-инсайт (сводка объёма словами) */}
        <Skeleton className="mt-4 h-24 w-full rounded-2xl" />

        {/* KPI: 2 кол на телефоне, 4 на десктопе */}
        <section className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((kpi) => (
            <Skeleton key={kpi} className="h-24 rounded-xl" />
          ))}
        </section>

        {/* Шесть карточек-графиков (объём, 1RM, группы мышц, повторы,
            активность, тело) */}
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <section
            key={card}
            className="bg-card border-border mt-6 rounded-2xl border p-5"
          >
            <Skeleton className="mb-4 h-4 w-40" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </section>
        ))}
      </div>

      <span className="sr-only" role="status">
        Загрузка статистики…
      </span>
    </main>
  );
}
