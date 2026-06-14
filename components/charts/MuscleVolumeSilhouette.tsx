"use client";

import { useRouter } from "next/navigation";

import { BodySilhouette } from "@/components/avatar/BodySilhouette";
import {
  volumeHeatColors,
  type VolumePoint,
} from "@/lib/domain/avatar/volume-heat";

/** H17.2 — тело как навигация по объёму: heat-силуэт над MuscleVolumeBars красит
 *  каждую группу реальным hex-цветом нагрева из её тоннажа за период (монотонно
 *  длине бара ниже). Тап по группе ведёт в её панель на /profile (deep-link
 *  sub-slice A открывает панель на маунте). Клиентский — владеет useRouter;
 *  клик-логику несёт `onMuscle` BodySilhouette (reuse, R-04 — НЕ дубль). Нет
 *  данных за период → ничего (бары уже показывают пустое состояние, R-37). */
export function MuscleVolumeSilhouette({ data }: { data: VolumePoint[] }) {
  const router = useRouter();
  if (data.length === 0) return null;

  const colors = volumeHeatColors(data);

  return (
    <div className="mb-5 flex justify-center">
      <BodySilhouette
        ariaLabel="Нагрев групп мышц по объёму за период. Тап по группе — её история"
        className="h-28 w-36"
        shapeFill={(key) => ({ fill: colors[key] })}
        onMuscle={(key) => router.push(`/profile?muscle=${key}`)}
      />
    </div>
  );
}
