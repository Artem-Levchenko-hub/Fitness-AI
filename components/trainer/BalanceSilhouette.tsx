"use client";

import { useRouter } from "next/navigation";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import { muscleLabelRu, type MuscleKey } from "@/lib/domain/avatar/heat";

/** H17.0-B — принимающий конец петли «текст тренера → тело»: тренер назвал
 *  группы баланса (balanceMuscleKeys) → подсвечиваем их на мини-силуэте, а
 *  доступные с клавиатуры кнопки ведут в историю конкретной группы. */
export function BalanceSilhouette({ muscleKeys }: { muscleKeys: MuscleKey[] }) {
  const router = useRouter();
  const uniqueMuscleKeys = [...new Set(muscleKeys)];
  const highlighted = new Set<string>(uniqueMuscleKeys);
  const names = uniqueMuscleKeys.map(muscleLabelRu).join(", ");

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        <BodySilhouette
          ariaLabel={`Баланс групп: ${names}`}
          className="h-16 w-20"
          shapeFill={(key) => ({
            className: highlighted.has(key)
              ? "fill-primary"
              : "fill-muted-foreground/20",
          })}
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Откройте историю нужной группы:
        </p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="История групп мышц">
        {uniqueMuscleKeys.map((key) => (
          <button
            key={key}
            type="button"
            className="border-border bg-background hover:bg-accent focus-visible:ring-ring min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            onClick={() => router.push(`/profile?muscle=${key}`)}
          >
            {muscleLabelRu(key)}
          </button>
        ))}
      </div>
    </div>
  );
}
