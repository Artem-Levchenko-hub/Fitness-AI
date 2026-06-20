"use client";

import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  extractPartialTrainer,
  splitTrainerStream,
  type PartialTrainer,
} from "@/lib/ai/trainer-stream-parse";

import {
  TrainerResultCard,
  type TrainerResultData,
} from "./TrainerResultCard";
import { TrainerWaiting } from "./TrainerWaiting";
import { useTypewriter } from "./use-typewriter";

type Phase = "streaming" | "loading-result" | "done" | "error";

/** F8-B / H-LIVE: живой стрим разбора. POST /api/ai/trainer/stream генерирует
 *  inline (без cron/poll) и льёт кадрированный поток: JSON разбора + «мысли»
 *  модели (reasoning). Через толерантный парсер показываем РОЖДАЮЩИЙСЯ разбор в
 *  реальном времени (как тренер пишет) — оценка считается вверх, мотивация,
 *  «что хорошо», рекомендации печатаются ровным ритмом. До первого поля сверху —
 *  лоадер + тикер «тренер размышляет» (живой reasoning). По завершении —
 *  перечитываем сохранённый structured-разбор (цветные дельты F4). */
export function TrainerStreamConsumer({
  workoutId,
  exerciseLinks,
  linkLifeFactors,
  pastAdviceHref,
}: {
  workoutId: string;
  exerciseLinks?: Record<string, string>;
  linkLifeFactors?: boolean;
  pastAdviceHref?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("streaming");
  const [result, setResult] = useState<TrainerResultData | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [partial, setPartial] = useState<PartialTrainer>({});
  const [thinking, setThinking] = useState("");
  const [attempt, setAttempt] = useState(0);

  const startedRef = useRef(false);
  useEffect(() => {
    startedRef.current = false;
  }, [attempt]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setPhase("streaming");
      setPartial({});
      setThinking("");
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
        setErrorText(
          res.status === 503
            ? "AI-тренер временно выключен."
            : "Не получилось запустить разбор.",
        );
        setPhase("error");
        return;
      }

      // Копим текст потока, делим на дорожки (JSON разбора / reasoning) и достаём
      // готовые поля для живой «печати».
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let acc = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            acc += decoder.decode(value, { stream: true });
            if (!cancelled) {
              const { thinking: th, json } = splitTrainerStream(acc);
              setThinking(th);
              setPartial(extractPartialTrainer(json));
            }
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

  // Есть уже хоть одно готовое поле → показываем живой черновик; до первого
  // слова — лоадер + книжные факты + тикер «мыслей» (TrainerWaiting).
  const hasDraft =
    partial.overallScore != null ||
    Boolean(partial.motivation) ||
    Boolean(partial.qualityComment) ||
    Boolean(partial.whatWorked) ||
    (partial.recommendations?.length ?? 0) > 0;

  if (!hasDraft) {
    return (
      <TrainerWaiting
        workoutId={workoutId}
        text="Тренер анализирует тренировку…"
        thinking={thinking}
      />
    );
  }

  return <LiveTrainerDraft partial={partial} streaming={phase === "streaming"} />;
}

/** Живой черновик разбора: поля проступают (Framer) и печатаются ровным ритмом,
 *  оценка считается вверх, в конце активного поля — плавная каретка. Это «как
 *  тренер пишет в реальном времени». */
function LiveTrainerDraft({
  partial,
  streaming,
}: {
  partial: PartialTrainer;
  streaming: boolean;
}) {
  const reduced = useReducedMotion() ?? false;
  const hasRecs = (partial.recommendations?.length ?? 0) > 0;

  return (
    <motion.div
      layout={!reduced}
      role="status"
      aria-busy={streaming}
      aria-live="polite"
      className="bg-card border-border space-y-5 rounded-2xl border p-6"
    >
      <p className="text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] uppercase">
        <span className="bg-primary trainer-caret size-1.5 rounded-full" />
        Тренер пишет разбор
      </p>

      {partial.overallScore != null ? (
        <Field reduced={reduced}>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Оценка тренера
          </p>
          <p className="font-serif tabular text-3xl font-normal">
            <ScoreCountUp value={partial.overallScore} reduced={reduced} />
            <span className="text-muted-foreground text-lg">/100</span>
          </p>
        </Field>
      ) : null}

      {partial.motivation ? (
        <Field reduced={reduced}>
          <p className="border-l-primary/40 border-l-2 pl-4 text-sm leading-relaxed font-medium">
            <TypingText text={partial.motivation} />
            {streaming && !partial.qualityComment ? <Caret /> : null}
          </p>
        </Field>
      ) : null}

      {partial.qualityComment ? (
        <Field reduced={reduced}>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Качество тренировки
          </p>
          <p className="text-sm leading-relaxed">
            <TypingText text={partial.qualityComment} />
            {streaming && !partial.whatWorked ? <Caret /> : null}
          </p>
        </Field>
      ) : null}

      {partial.whatWorked ? (
        <Field reduced={reduced}>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Что хорошо
          </p>
          <p className="text-sm leading-relaxed">
            <TypingText text={partial.whatWorked} />
            {streaming && !hasRecs ? <Caret /> : null}
          </p>
        </Field>
      ) : null}

      {partial.recommendations?.length ? (
        <Field reduced={reduced}>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Рекомендации
          </p>
          <ul className="mt-1 space-y-1.5">
            {partial.recommendations.map((rec, i) => (
              <motion.li
                key={i}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-2 text-sm leading-relaxed"
              >
                <span className="text-primary">•</span>
                <span>{rec}</span>
              </motion.li>
            ))}
          </ul>
        </Field>
      ) : null}

      {partial.nextSessionFocus ? (
        <Field reduced={reduced}>
          <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
            Фокус на следующую
          </p>
          <p className="text-sm leading-relaxed italic">
            <TypingText text={partial.nextSessionFocus} />
          </p>
        </Field>
      ) : null}
    </motion.div>
  );
}

/** Печатает текст ровным ритмом поверх бурстящего стрима (см. useTypewriter). */
function TypingText({ text }: { text: string }) {
  return <>{useTypewriter(text)}</>;
}

/** Плавная каретка (CSS-кейфрейм, не жёсткий blink) в конце активного поля. */
function Caret() {
  return (
    <span
      aria-hidden="true"
      className="bg-primary trainer-caret ml-0.5 inline-block h-4 w-0.5 align-middle"
    />
  );
}

/** Оценка считается вверх до значения (motion-safe). */
function ScoreCountUp({ value, reduced }: { value: number; reduced: boolean }) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduced) return; // reduced → рендерим value напрямую ниже, без setState
    const controls = animate(mv, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return <>{reduced ? value : display}</>;
}

/** Обёртка-поле с мягким проявлением (Framer, motion-safe). */
function Field({
  children,
  reduced,
}: {
  children: ReactNode;
  reduced: boolean;
}) {
  return (
    <motion.div
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-1"
    >
      {children}
    </motion.div>
  );
}
