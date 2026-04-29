import type { Metadata } from "next";

export const metadata: Metadata = { title: "Заметки" };

export default function NotesPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
        Заметки
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Связанные markdown-заметки на упражнения, тренировки и микроциклы. AI
        читает их при анализе. Phase 4.
      </p>
    </main>
  );
}
