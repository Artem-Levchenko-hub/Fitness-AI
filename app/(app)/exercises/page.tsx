import type { Metadata } from "next";

export const metadata: Metadata = { title: "Упражнения" };

export default function ExercisesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Упражнения
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Каталог системных и пользовательских упражнений. Phase 2.
      </p>
    </main>
  );
}
