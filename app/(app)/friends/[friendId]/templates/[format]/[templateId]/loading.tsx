import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div aria-hidden="true">
        <Skeleton className="mb-5 h-8 w-36" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-8 w-64" />
        <Skeleton className="mt-3 mb-6 h-4 w-40" />
        <div className="space-y-2">{[0, 1, 2].map((row) => <Skeleton key={row} className="h-20 w-full rounded-xl" />)}</div>
      </div>
      <span role="status" className="sr-only">Загрузка шаблона друга…</span>
    </main>
  );
}
