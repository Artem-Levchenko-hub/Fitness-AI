"use client"; // Error boundaries must be Client Components (Next 16)

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error-состояние раздела программ (R-37). Ловит сбой загрузки программы и даёт
 *  повтор без перезагрузки. Next 16: проп `unstable_retry`, НЕ `reset`. */
export default function ProgramsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("program load failed", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <div className="bg-card border-border space-y-4 rounded-2xl border p-8 text-center">
        <div className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-foreground text-base font-medium">
            Не удалось загрузить программу
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Что-то пошло не так. Попробуйте ещё раз — ваши программы на месте.
          </p>
        </div>
        <Button size="xl" className="w-full" onClick={() => unstable_retry()}>
          Повторить
        </Button>
      </div>
    </main>
  );
}
