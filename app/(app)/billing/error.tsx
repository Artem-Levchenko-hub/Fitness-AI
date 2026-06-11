"use client"; // Error boundaries must be Client Components (Next 16)

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/** Error-состояние экрана «Баланс» (R-37). Ловит сбой загрузки баланса/операций
 *  (например, недоступность БД при getOrCreateBalance/listTransactions) и даёт
 *  повтор без перезагрузки страницы. Деньги не теряются — это только ошибка
 *  ЧТЕНИЯ, баланс на сервере цел. Next 16: проп называется `unstable_retry`,
 *  НЕ `reset`. */
export default function BillingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Серверная ошибка приходит на клиент с digest — по нему её видно в логах.
    console.error("billing load failed", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Кошелёк
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Баланс
        </h1>
      </header>

      <div className="bg-card border-border space-y-4 rounded-2xl border p-8 text-center">
        <div className="bg-destructive/10 text-destructive mx-auto flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="text-foreground text-base font-medium">
            Не удалось загрузить баланс
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Что-то пошло не так при загрузке баланса и истории операций.
            Попробуйте ещё раз — деньги на счёте в безопасности.
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
