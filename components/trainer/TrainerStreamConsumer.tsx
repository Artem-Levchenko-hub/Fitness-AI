"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

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
export function TrainerStreamConsumer({ workoutId }: { workoutId: string }) {
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
    return <TrainerResultCard data={result} />;
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
    <LoadingState
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

function LoadingState({ text }: { text: string }) {
  return (
    <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-6">
      <Loader2 className="text-primary size-5 animate-spin" />
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}
