"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { TrainerResultCard } from "@/components/trainer/TrainerResultCard";
import { Button } from "@/components/ui/button";
import {
  requestWeeklyReview,
  type WeeklyReviewResult,
} from "@/server/actions/weekly-review";

/** H8.1 — кнопка «Разбор недели» на /stats. Синхронно зовёт тренера на итог
 *  ISO-недели (эта vs прошлая) и показывает результат под кнопкой. 4 состояния
 *  (R-37): idle / loading / error / loaded. */
export function WeeklyReviewButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<WeeklyReviewResult | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    try {
      setResult(await requestWeeklyReview());
    } catch {
      setResult({
        ok: false,
        error: "Не удалось получить разбор недели. Попробуйте ещё раз.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="bg-card border-border mt-4 rounded-2xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <CalendarRange className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-normal tracking-tight">
            Разбор недели от тренера
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Итог этой ISO-недели в сравнении с прошлой: объём, баланс по группам
            мышц и фокус на следующую неделю.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={run}
            className="mt-4"
            size="lg"
          >
            {pending ? "Разбираю неделю…" : "Разобрать неделю"}
          </Button>
        </div>
      </div>

      {result && !result.ok ? (
        <p className="text-muted-foreground border-warning/30 bg-warning/5 mt-4 rounded-xl border p-4 text-sm leading-relaxed">
          {result.error}
        </p>
      ) : null}

      {result && result.ok ? (
        <TrainerResultCard data={result.data} className="mt-4" />
      ) : null}
    </section>
  );
}
