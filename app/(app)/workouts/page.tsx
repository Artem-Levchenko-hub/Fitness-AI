import type { Metadata } from "next";

export const metadata: Metadata = { title: "Тренировки" };

export default function WorkoutsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Тренировки
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Здесь появится история тренировок и активная сессия. Phase 3.
      </p>
    </main>
  );
}
