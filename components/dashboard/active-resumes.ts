import { cancelCardioAction } from "@/server/actions/cardio";
import { cancelCircuitAction } from "@/server/actions/circuits";
import { cancelWorkoutAction } from "@/server/actions/workouts";

import type { ResumeCancel } from "./ResumeBanner";

export type Resume = { href: string; label: string; cancel?: ResumeCancel };

/** Единая сборка resume-баннеров активных сессий (силовая / круговая / кардио)
 *  для дашборда и /workouts — одна правда о подписях и кнопке «Убрать»,
 *  чтобы тексты не разъезжались между двумя экранами. Все три формата несут
 *  «Убрать» (H2): зависшую активную сессию можно отменить прямо из баннера, не
 *  заходя в неё — иначе брошенный active-сеанс висел бы «фантомом» вечно. */
export function buildResumes(opts: {
  activeId: string | null;
  activeCircuitId: string | null;
  activeCardioId: string | null;
}): Resume[] {
  const { activeId, activeCircuitId, activeCardioId } = opts;
  const cancelDescription =
    "Сессия будет отменена. Прогресс не попадёт в историю и статистику.";

  const entries: (Resume | null)[] = [
    activeId
      ? {
          href: `/workouts/${activeId}`,
          label: "Активная тренировка",
          cancel: {
            action: cancelWorkoutAction,
            idField: "workoutId",
            id: activeId,
            title: "Убрать активную тренировку?",
            description: cancelDescription,
          },
        }
      : null,
    activeCircuitId
      ? {
          href: `/circuits/${activeCircuitId}`,
          label: "Активная круговая",
          cancel: {
            action: cancelCircuitAction,
            idField: "circuitId",
            id: activeCircuitId,
            title: "Убрать активную круговую?",
            description: cancelDescription,
          },
        }
      : null,
    activeCardioId
      ? {
          href: `/cardio/${activeCardioId}`,
          label: "Активная кардио-сессия",
          cancel: {
            action: cancelCardioAction,
            idField: "cardioId",
            id: activeCardioId,
            title: "Убрать активную кардио-сессию?",
            description: cancelDescription,
          },
        }
      : null,
  ];

  return entries.filter((r): r is Resume => r !== null);
}
