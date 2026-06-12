"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/index";

import {
  TrainerResultCard,
  type TrainerResultData,
} from "./TrainerResultCard";

type Phase = "streaming" | "loading-result" | "done" | "error";

/** F8-B run-2: live-стрим разбора. POST /api/ai/trainer/stream генерирует
 *  inline (без cron/poll). Стрим эмитит СЫРОЙ JSON (+ reasoning у thinking-
 *  модели) — НЕ рендерим его как текст, только индикатор прогресса по факту
 *  поступления байт. По завершении — перечитываем сохранённый structured
 *  разбор (GET /api/ai/trainer/latest) и показываем цветные дельты F4. */
export function TrainerStreamConsumer({
  workoutId,
  exerciseLinks,
  linkLifeFactors,
  pastAdviceHref,
}: {
  workoutId: string;
  /** H13.1 — карта имя→exerciseId своей тренировки (см. TrainerResultCard). */
  exerciseLinks?: Record<string, string>;
  /** H13.2 — на своём разборе заголовки факторов жизни кликабельны. */
  linkLifeFactors?: boolean;
  /** H13.5 — ссылка из «Прошлый совет» на прошлый разбор (см. TrainerResultCard). */
  pastAdviceHref?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("streaming");
  const [result, setResult] = useState<TrainerResultData | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [bytes, setBytes] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Защита от двойного запуска (StrictMode dev мог бы дважды дёрнуть стрим).
  const startedRef = useRef(false);

  useEffect(() => {
    startedRef.current = false;
  }, [attempt]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    // Локальный AbortController только для cleanup на размонтировании. Сервер
    // продолжит генерацию (endpoint использует timeout, не request.signal),
    // поэтому уход со страницы не теряет разбор.
    const controller = new AbortController();

    const run = async () => {
      setPhase("streaming");
      setBytes(0);
      setErrorText(null);

      let res: Response;
      try {
        res = await fetch("/api/ai/trainer/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workoutId }),
          signal: controller.signal,
          cache: "no-store",
        });
      } catch {
        if (!cancelled) {
          setErrorText("Не удалось связаться с тренером. Проверь соединение.");
          setPhase("error");
        }
        return;
      }

      if (!res.ok) {
        if (cancelled) return;
        const msg =
          res.status === 503
            ? "AI-тренер временно выключен."
            : "Не получилось запустить разбор.";
        setErrorText(msg);
        setPhase("error");
        return;
      }

      // Дренируем стрим ради прогресса; содержимое (сырой JSON) не показываем.
      const reader = res.body?.getReader();
      if (reader) {
        let received = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value?.byteLength ?? 0;
            if (!cancelled) setBytes(received);
          }
        } catch {
          // Стрим оборвался — onFinish на сервере всё равно мог сохранить.
        }
      }

      if (cancelled) return;
      setPhase("loading-result");

      // onFinish сохраняет ai_analyses чуть позже закрытия стрима → ретраим.
      for (let i = 0; i < 6; i++) {
        try {
          const r = await fetch(
            `/api/ai/trainer/latest?workoutId=${encodeURIComponent(workoutId)}`,
            { cache: "no-store", signal: controller.signal },
          );
          if (r.ok) {
            const data = (await r.json()) as {
              analysis: { resultJson: TrainerResultData | null } | null;
            };
            if (data.analysis?.resultJson) {
              if (cancelled) return;
              setResult(data.analysis.resultJson);
              setPhase("done");
              return;
            }
          }
        } catch {
          if (cancelled) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (!cancelled) {
        setErrorText("Разбор не сохранился. Попробуй обновить.");
        setPhase("error");
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [workoutId, attempt]);

  if (phase === "done" && result) {
    return (
      <TrainerResultCard
        data={result}
        exerciseLinks={exerciseLinks}
        linkLifeFactors={linkLifeFactors}
        pastAdviceHref={pastAdviceHref}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="bg-card border-border space-y-3 rounded-2xl border p-6">
        <p className="text-destructive text-sm font-medium">
          {errorText ?? "Что-то пошло не так"}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => setAttempt((a) => a + 1)}
        >
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <TrainerSkeleton
      text={
        phase === "loading-result"
          ? "Собираю разбор…"
          : bytes > 0
            ? "Тренер пишет разбор…"
            : "Тренер анализирует тренировку…"
      }
    />
  );
}

/** Скелетон в форме будущей карточки разбора. Стрим не отдаёт Content-Length
 *  (streamText), поэтому честный индикатор — не прогресс-бар по процентам, а
 *  каркас того, что вот-вот появится: оценка, заметка, аспекты, сравнения,
 *  рекомендации. Реальный статус-текст сверху меняется по факту байт стрима. */
function TrainerSkeleton({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-card border-border space-y-6 rounded-2xl border p-6"
    >
      <p className="text-muted-foreground flex items-center gap-2 text-sm leading-relaxed">
        <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
        {text}
      </p>

      <div
        aria-hidden="true"
        className="animate-pulse space-y-6 motion-reduce:animate-none"
      >
        {/* Оценка + иконка */}
        <div className="flex items-start justify-between gap-4">
          <Bar className="h-12 w-28" />
          <Bar className="size-10 rounded-full" />
        </div>

        {/* Мотивация (цитата) */}
        <div className="space-y-2 border-l-border border-l-2 pl-4">
          <Bar className="h-4 w-3/4" />
          <Bar className="h-4 w-1/2" />
        </div>

        {/* Аспекты */}
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-5/6" />
            </div>
          ))}
        </div>

        {/* Сравнения по упражнениям */}
        <div className="space-y-1.5">
          <Bar className="h-9 w-full rounded-lg" />
          <Bar className="h-9 w-full rounded-lg" />
        </div>

        {/* Рекомендации */}
        <div className="space-y-2">
          <Bar className="h-4 w-48" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-11/12" />
          <Bar className="h-3 w-4/5" />
        </div>
      </div>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return <div className={cn("bg-muted rounded", className)} />;
}
