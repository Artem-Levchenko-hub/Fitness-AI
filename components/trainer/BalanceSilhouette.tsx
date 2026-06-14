"use client";

import { useRouter } from "next/navigation";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import { muscleLabelRu, type MuscleKey } from "@/lib/domain/avatar/heat";

/** H17.0-B — принимающий конец петли «текст тренера → тело»: тренер назвал
 *  группы баланса (balanceMuscleKeys) → подсвечиваем их на мини-силуэте, тап по
 *  группе ведёт в её панель на /profile (deep-link sub-slice A открывает панель
 *  на маунте). Клиентский, владеет useRouter; силуэт визуально-агностичен —
 *  клик-логику несёт onMuscle (reuse H17.2 на /stats — R-04). */
export function BalanceSilhouette({ muscleKeys }: { muscleKeys: MuscleKey[] }) {
  const router = useRouter();
  const highlighted = new Set<string>(muscleKeys);
  const names = muscleKeys.map(muscleLabelRu).join(", ");

  return (
    <div className="mt-3 flex items-center gap-3">
      <BodySilhouette
        ariaLabel={`Баланс групп: ${names}. Тап по группе — её история`}
        className="h-16 w-20"
        shapeFill={(key) => ({
          className: highlighted.has(key)
            ? "fill-primary"
            : "fill-muted-foreground/20",
        })}
        onMuscle={(key) => router.push(`/profile?muscle=${key}`)}
      />
      <p className="text-muted-foreground text-xs leading-relaxed">
        Тап по группе — её история:{" "}
        <span className="text-foreground font-medium">{names}</span>
      </p>
    </div>
  );
}
