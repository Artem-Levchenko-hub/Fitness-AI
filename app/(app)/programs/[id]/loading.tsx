import { Skeleton } from "@/components/ui/skeleton";

/** Loading-состояние страницы тренировочной системы (R-37). Next 16: loading.tsx
 *  авто-оборачивает сегмент в <Suspense>, пока грузятся дни программы. */
export default function ProgramLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-4 h-8 w-28" />
        <Skeleton className="mb-2 h-8 w-56" />
        <Skeleton className="mb-6 h-4 w-72" />
        <ul className="space-y-2">
          {[0, 1, 2, 3].map((card) => (
            <li key={card}>
              <Skeleton className="h-[64px] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      </div>
      <span className="sr-only" role="status">
        Загрузка программы…
      </span>
    </main>
  );
}
