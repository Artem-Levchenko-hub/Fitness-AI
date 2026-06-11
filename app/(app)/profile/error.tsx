"use client";

import { Button } from "@/components/ui/button";

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 px-5 pt-16 text-center md:px-8">
      <h1 className="font-serif text-2xl font-normal tracking-tight">
        Не удалось загрузить профиль
      </h1>
      <p className="text-muted-foreground text-sm">
        Что-то пошло не так при сборке 3D-аватара. Попробуй ещё раз.
      </p>
      <Button onClick={reset} variant="outline">
        Повторить
      </Button>
    </main>
  );
}
