import { summarizeCardioTemplate } from "@/lib/domain/cardio/cardio-template-summary";
import { presetToBlocks, totalPlannedSec, type PlannedBlock } from "@/lib/domain/cardio/presets";
import { formatExerciseCount, type TemplateFormat } from "@/lib/domain/templates/template-list";
import { getCardioTemplateForEdit, listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { getCircuitTemplateForEdit, listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { listExercises } from "@/lib/repos/exercises.repo";
import { getFriendProfile, type FriendUser } from "@/lib/repos/friends.repo";
import { getTemplateWithItems, listTemplates } from "@/lib/repos/templates.repo";

export type SharedFriendTemplate = {
  friend: FriendUser;
  id: string;
  name: string;
  description: string | null;
  format: TemplateFormat;
  summary: string[];
  exercises: { id: string; name: string; target: string; notes: string | null }[];
  blocks: PlannedBlock[];
};

/** Every direct URL rechecks friendship and sharing before reading a template.
 * Membership in the same shared list also excludes archives and hidden program days.
 * Existing owner-only read and write routes keep their original authorization. */
export async function getSharedFriendTemplate(
  viewerId: string,
  friendId: string,
  format: string,
  templateId: string,
): Promise<SharedFriendTemplate | null> {
  if (format !== "strength" && format !== "circuit" && format !== "cardio") return null;
  const friend = await getFriendProfile(viewerId, friendId);
  if (!friend?.sharesPrograms) return null;

  const templates = await (format === "strength"
    ? listTemplates(friendId)
    : format === "circuit"
      ? listCircuitTemplates(friendId)
      : listCardioTemplates(friendId));
  const listed = templates.find((template) => template.id === templateId);
  if (!listed) return null;

  const base: Pick<SharedFriendTemplate, "friend" | "id" | "name" | "description" | "format"> = {
    friend: { id: friend.id, name: friend.name, email: friend.email },
    id: templateId,
    name: listed.name,
    description: listed.description,
    format,
  };

  if (format === "strength") {
    const template = await getTemplateWithItems(friendId, templateId);
    if (!template) return null;
    return {
      ...base,
      name: template.name,
      description: template.description,
      summary: ["Силовая", formatExerciseCount(template.items.length)],
      exercises: template.items.map((item) => {
        const reps = item.targetRepsMin === item.targetRepsMax
          ? String(item.targetRepsMin)
          : `${item.targetRepsMin}–${item.targetRepsMax}`;
        const target = [item.myoReps
          ? `Мио-репсы: ${reps} + ${item.myoMiniSets}×30% от активации (отдых ${item.myoMiniRestSeconds}с)`
          : `${item.targetSets}×${reps}`];
        if (item.targetWeightKg != null) target.push(`${item.targetWeightKg} кг`);
        target.push(`отдых ${item.targetRestSeconds}с`);
        return { id: item.id, name: item.exerciseNameRu, target: target.join(" · "), notes: item.notes ?? null };
      }),
      blocks: [],
    };
  }

  if (format === "circuit") {
    const template = await getCircuitTemplateForEdit(friendId, templateId);
    if (!template) return null;
    const names = new Map((await listExercises(friendId)).map((exercise) => [exercise.id, exercise.nameRu]));
    return {
      ...base,
      name: template.name,
      summary: ["Круговая", `Кругов: ${template.totalRounds}`, `Отдых между кругами: ${template.restBetweenRoundsSec}с`, `Между упражнениями: ${template.restBetweenExercisesSec}с`],
      exercises: template.exercises.map((item) => ({
        id: item.id,
        name: names.get(item.exerciseId) ?? "Упражнение",
        target: [item.kind === "duration" ? `${item.targetDurationSec ?? 0}с` : `${item.targetReps ?? 0} повт.`, ...(item.targetWeightKg != null ? [`${item.targetWeightKg} кг`] : [])].join(" · "),
        notes: item.notes,
      })),
      blocks: [],
    };
  }

  const template = await getCardioTemplateForEdit(friendId, templateId);
  if (!template) return null;
  const blocks = presetToBlocks(template.preset, template.planJson ?? undefined);
  return {
    ...base,
    name: template.name,
    summary: ["Кардио", summarizeCardioTemplate(template.preset, template.planJson), `Всего: ${totalPlannedSec(blocks)}с`],
    exercises: [],
    blocks,
  };
}
