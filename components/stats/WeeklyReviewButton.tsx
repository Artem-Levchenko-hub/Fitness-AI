"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { TrainerResultCard } from "@/components/trainer/TrainerResultCard";
import { Button } from "@/components/ui/button";
import type { TrainerResponse } from "@/lib/ai/trainer-parse";
import { requestWeeklyReview } from "@/server/actions/weekly-review";

/** H8.1 + H8.2c — «Разбор недели» на /stats. По умолчанию показывает
 *  последний АВТО-сгенерированный недельный разбор (воркер H8.2 ставит его сам
 *  по закрытии ISO-недели), кнопка пере-запрашивает синхронно (H8.1). 4
 *  состояния (R-37): idle (нет авто-разбора → CTA) / loading / error / loaded. */
export function WeeklyReviewButton({
  initial = null,
  initialAt = null,
}: {
  /** Последний weekly_review из БД (уже провалидирован server-side). */
  initial?: TrainerResponse | null;
  /** Дата авто-разбора, отформатированная на сервере (ru). */
  initialAt?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<TrainerResponse | null>(initial);
  const [error, setError] = useState<string | null>(null);
  // true после ручного «Разобрать заново» — тогда подпись «авто от <дата>»
  // больше не релевантна (показываем свежий on-demand-разбор).
  const [regenerated, setRegenerated] = useState(false);

  const run = async () => {
    setPending(true);
    setError(null);
    try {
      const r = await requestWeeklyReview();
      if (r.ok) {
        setData(r.data);
        setRegenerated(true);
      } else {
        setError(r.error);
      }
    } catch {
      setError("Не удалось получить разбор недели. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  const showAutoCaption = data && !regenerated && initialAt;

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
            {pending
              ? "Разбираю неделю…"
              : data
                ? "Разобрать заново"
                : "Разобрать неделю"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-muted-foreground border-warning/30 bg-warning/5 mt-4 rounded-xl border p-4 text-sm leading-relaxed">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="mt-4">
          {showAutoCaption ? (
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-[0.18em] uppercase">
              Авто-разбор недели · {initialAt}
            </p>
          ) : null}
          <TrainerResultCard data={data} />
        </div>
      ) : null}
    </section>
  );
}
