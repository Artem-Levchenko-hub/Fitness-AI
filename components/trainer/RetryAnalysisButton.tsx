"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryAnalysisAction } from "@/server/actions/trainer";

/** Кнопка принудительного перезапуска пост-тренировочного AI-разбора — для
 *  состояний «анализ не запустился»: job failed терминально, застрял в running
 *  или вовсе не создан. После постановки в очередь router.refresh() переводит
 *  страницу на обычный носитель ожидания (TrainerJobPoller / pending-блок),
 *  который сам покажет готовый разбор. */
export function RetryAnalysisButton({
  workoutId,
  circuitWorkoutId,
  label = "Запустить анализ заново",
}: {
  workoutId?: string;
  circuitWorkoutId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const retry = () => {
    startTransition(async () => {
      const res = await retryAnalysisAction({ workoutId, circuitWorkoutId });
      switch (res.status) {
        case "queued":
          toast.success("Анализ поставлен в очередь — тренер взялся за разбор");
          router.refresh();
          break;
        case "exists":
          toast.success("Разбор уже готов");
          router.refresh();
          break;
        case "already_running":
          toast.info("Анализ уже генерируется — ещё немного");
          router.refresh();
          break;
        case "error":
          toast.error(res.message);
          break;
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={retry}
      data-testid="retry-analysis"
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
      {pending ? "Запускаем…" : label}
    </Button>
  );
}
