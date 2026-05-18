"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TrainerJobPoller } from "@/components/trainer/TrainerJobPoller";
import { requestTrainerOnDemand } from "@/server/actions/trainer";

/** Кнопка «Спросить тренера» на дашборде. Создаёт on_demand job
 *  и отображает TrainerJobPoller прямо под ней. */
export function TrainerTrigger({
  lastWorkoutId,
}: {
  lastWorkoutId: string | null;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const start = async () => {
    setPending(true);
    try {
      const r = await requestTrainerOnDemand(lastWorkoutId);
      setJobId(r.jobId);
    } finally {
      setPending(false);
    }
  };

  if (jobId) {
    return (
      <TrainerJobPoller
        jobId={jobId}
        onRetry={async () => {
          const r = await requestTrainerOnDemand(lastWorkoutId);
          return { jobId: r.jobId };
        }}
      />
    );
  }

  return (
    <div className="bg-card border-border rounded-2xl border p-6">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-serif text-xl font-normal tracking-tight">
            Спросить тренера
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {lastWorkoutId
              ? "Получите разбор последней тренировки с учётом сна и КБЖУ за неделю."
              : "Пока нет завершённых тренировок. Завершите одну — тренер автоматически её разберёт."}
          </p>
          <Button
            type="button"
            disabled={pending || !lastWorkoutId}
            onClick={start}
            className="mt-4"
            size="lg"
          >
            {pending ? "Запускаю…" : "Получить разбор"}
          </Button>
        </div>
      </div>
    </div>
  );
}
