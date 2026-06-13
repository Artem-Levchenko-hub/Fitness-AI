"use server";

import { buildResumes } from "@/components/dashboard/active-resumes";
import type { ResumeView } from "@/components/dashboard/resume-visibility";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveCardioId } from "@/lib/repos/cardio.repo";
import { getActiveCircuitId } from "@/lib/repos/circuits.repo";
import { getActiveWorkoutId } from "@/lib/repos/workouts.repo";

/** Свежий список активных сессий для ГЛОБАЛЬНОЙ полосы возобновления (H12.4).
 *  Layout client-кэшируется и НЕ ре-рендерится при навигации (Next docs), поэтому
 *  GlobalResumeBar дёргает это на каждой смене pathname — иначе полоса «застывала»
 *  бы на состоянии первого рендера (старт сессии → переход → полоса не появилась).
 *  Только навигация (href+label), без `cancel`. R-7: repo-фильтр по userId. */
export async function getActiveResumes(): Promise<ResumeView[]> {
  const user = await requireUser();
  const [activeId, activeCircuitId, activeCardioId] = await Promise.all([
    getActiveWorkoutId(user.id),
    getActiveCircuitId(user.id),
    getActiveCardioId(user.id),
  ]);
  return buildResumes({ activeId, activeCircuitId, activeCardioId }).map(
    (r) => ({ href: r.href, label: r.label }),
  );
}
