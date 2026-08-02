"use client";

import { useRouter } from "next/navigation";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import {
  MUSCLE_KEYS,
  muscleLabelRu,
  type MuscleKey,
} from "@/lib/domain/avatar/heat";
import {
  volumeHeatColors,
  type VolumePoint,
} from "@/lib/domain/avatar/volume-heat";

/** H17.2 — тело как навигация по объёму: heat-силуэт над MuscleVolumeBars красит
 *  каждую группу реальным hex-цветом нагрева из её тоннажа за период (монотонно
 *  длине бара ниже). Отдельные кнопки ведут в панель группы на /profile и
 *  остаются доступными для клавиатуры и скринридера. Нет
 *  данных за период → ничего (бары уже показывают пустое состояние, R-37). */
export function MuscleVolumeSilhouette({ data }: { data: VolumePoint[] }) {
  const router = useRouter();
  if (data.length === 0) return null;

  const colors = volumeHeatColors(data);
  const knownKeys = new Set<string>(MUSCLE_KEYS);
  const muscleKeys = [...new Set(data.map((point) => point.muscleKey))].filter(
    (key): key is MuscleKey => knownKeys.has(key),
  );

  return (
    <div className="mb-5 space-y-3">
      <BodySilhouette
        ariaLabel="Нагрев групп мышц по объёму за период"
        className="mx-auto h-28 w-36"
        shapeFill={(key) => ({ fill: colors[key] })}
      />
      <div
        className="flex flex-wrap justify-center gap-2"
        aria-label="Открыть историю группы мышц"
      >
        {muscleKeys.map((key) => (
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
