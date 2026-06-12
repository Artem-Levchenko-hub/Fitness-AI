"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import {
  TrainerResultCard,
  type TrainerResultData,
} from "./TrainerResultCard";

type JobStatus = "pending" | "running" | "succeeded" | "failed";

type JobResponse = {
  id: string;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  workoutId: string | null;
  analysis: {
    id: string;
    content: string;
    resultJson: TrainerResultData | null;
    modelVersion: string;
    createdAt: string;
  } | null;
};

/** Поллит /api/ai/jobs/[id] каждые 2с пока не succeeded/failed.
 *  Когда готово — показывает TrainerResultCard. При failed — даёт кнопку
 *  «Повторить» (создаст новый job через server action callerProvidedRetry). */
export function TrainerJobPoller({
  jobId,
  onRetry,
  exerciseLinks,
  linkLifeFactors,
}: {
  jobId: string;
  onRetry?: () => Promise<{ jobId: string }>;
  /** H13.1 — карта имя→exerciseId своей тренировки (см. TrainerResultCard). */
  exerciseLinks?: Record<string, string>;
  /** H13.2 — на своём разборе заголовки факторов жизни кликабельны. */
  linkLifeFactors?: boolean;
}) {
  const [currentJobId, setCurrentJobId] = useState(jobId);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    // При смене jobId сбрасываем старый результат, чтобы UI вернулся в
    // "Loading" между retry-job'ами. Lint предупреждает про cascading
    // re-render, но здесь сброс — это часть синхронизации с внешним job-id.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJob(null);
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const res = await fetch(`/api/ai/jobs/${currentJobId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as JobResponse;
        if (stopped) return;
        setJob(data);
        if (data.status === "succeeded" || data.status === "failed") return;
      } catch {
        if (stopped) return;
      }
      timer = setTimeout(tick, 2000);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [currentJobId]);

  if (!job) {
    return <LoadingState text="Тренер просматривает данные…" />;
  }

  if (job.status === "pending" || job.status === "running") {
    return (
      <LoadingState
        text={
          job.status === "running"
            ? "Тренер пишет разбор…"
            : "Задание в очереди — стартую…"
        }
      />
    );
  }

  if (job.status === "failed") {
    return (
      <div className="bg-card border-border space-y-3 rounded-2xl border p-6">
        <p className="text-destructive text-sm font-medium">
          Не получилось получить ответ тренера
        </p>
        {job.lastError ? (
          <p className="text-muted-foreground text-xs">{job.lastError}</p>
        ) : null}
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              try {
                const next = await onRetry();
                setCurrentJobId(next.jobId);
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? "Запускаю…" : "Повторить"}
          </Button>
        ) : null}
      </div>
    );
  }

  if (!job.analysis?.resultJson) {
    return (
      <div className="bg-card border-border rounded-2xl border p-6">
        <p className="text-muted-foreground text-sm">
          Разбор готов, но в нестандартном формате — открой текстовую версию
          через историю тренировок.
        </p>
      </div>
    );
  }

  return (
    <TrainerResultCard
      data={job.analysis.resultJson}
      exerciseLinks={exerciseLinks}
      linkLifeFactors={linkLifeFactors}
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
