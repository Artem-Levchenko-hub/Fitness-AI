export default function ProfileLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="bg-muted h-3 w-20 animate-pulse rounded" />
          <div className="bg-muted h-8 w-44 animate-pulse rounded" />
        </div>
        <div className="bg-muted size-11 shrink-0 animate-pulse rounded-full" />
      </header>

      <div className="bg-muted aspect-[3/4] w-full animate-pulse rounded-3xl" />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="bg-muted h-[76px] animate-pulse rounded-2xl" />
        <div className="bg-muted h-[76px] animate-pulse rounded-2xl" />
      </div>
    </main>
  );
}
