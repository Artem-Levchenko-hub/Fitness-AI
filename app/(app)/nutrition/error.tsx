"use client"; // Error boundaries must be Client Components (Next 16)

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error-состояние экрана «КБЖУ» (R-37). Ловит сбой загрузки данных питания
 *  (например, недоступность БД при getNutritionForDate / listRecentNutrition)
 *  и даёт повтор без перезагрузки страницы.
 *  Next 16: проп называется `unstable_retry`, НЕ `reset`. */
export default function NutritionError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Серверная ошибка приходит на клиент с digest — по нему её видно в логах.
    console.error("nutrition load failed", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Питание
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          КБЖУ сегодня
        </h1>
      </header>

      <div className="bg-card border-border space-y-4 rounded-2xl border p-8 text-center">
        <div className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-foreground text-base font-medium">
            Не удалось загрузить КБЖУ
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Что-то пошло не так при загрузке данных питания. Попробуйте ещё раз —
            ваши записи на месте.
          </p>
        </div>
        <div className="mt-2">
          <Button size="xl" className="w-full" onClick={() => unstable_retry()}>
            Повторить
          </Button>
        </div>
      </div>
    </main>
  );
}
