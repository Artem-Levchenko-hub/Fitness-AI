"use client";

import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { makeClientId } from "@/lib/storage/outbox";
import { startWorkoutFromTemplateAction } from "@/server/actions/workouts";

/**
 * H15.3c-2 — старт тренировки из шаблона со свежим клиентским ключом
 * идемпотентности (`clientWorkoutId`). Тонкая клиентская обёртка над серверным
 * `startWorkoutFromTemplateAction`: на КАЖДЫЙ сабмит дописывает в FormData новый
 * `makeClientId()` (как SetInput для clientSetId — не stale ref/hidden-input).
 *
 * Сейчас оживляет мёртвую колонку `workouts.client_workout_id` на ОНЛАЙН-пути
 * (зеркало clientSetId-плумбинга H15.3b). Офлайн-продюсер (virtual-workout +
 * startWorkout-мутация в outbox) и дренаж-remapping — следующий под-слайс.
 *
 * redirect() серверного экшена вызывается ВНЕ try/catch — навигация
 * пробрасывается фреймворком (context7 Next.js 16: form action + redirect).
 */
export function StartWorkoutButton({
  templateId,
  compact = false,
}: {
  templateId: string;
  compact?: boolean;
}) {
  async function start(formData: FormData) {
    formData.set("clientWorkoutId", makeClientId());
    await startWorkoutFromTemplateAction(formData);
  }

  return (
    <form action={start} className={compact ? "" : "mb-6"}>
      <input type="hidden" name="templateId" value={templateId} />
      <Button
        type="submit"
        size={compact ? "lg" : "xl"}
        className="w-full"
      >
        <Play className="size-5" />
        Начать тренировку
      </Button>
    </form>
  );
}
