import { formatTemplateMeta, mergeTemplateList, sortTemplatesForFlow } from "@/lib/domain/templates/template-list";
import { listCardioTemplates } from "@/lib/repos/cardio-templates.repo";
import { listCircuitTemplates } from "@/lib/repos/circuit-templates.repo";
import { getFriendProfile } from "@/lib/repos/friends.repo";
import { listTemplates } from "@/lib/repos/templates.repo";
import { listRecentWorkouts, listWorkoutScores } from "@/lib/repos/workouts.repo";

import { adminJson, adminRead } from "../../response";

export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return adminRead(async (adminId) => {
    const { id } = await context.params;
    const friend = await getFriendProfile(adminId, id);
    if (!friend) return adminJson({ error: "not_found" }, 404);

    const recent = await listRecentWorkouts(id, 30);
    const completed = recent.filter((workout) => workout.status === "completed");
    const [strength, circuit, cardio, scores] = await Promise.all([
      friend.sharesPrograms ? listTemplates(id) : [],
      friend.sharesPrograms ? listCircuitTemplates(id) : [],
      friend.sharesPrograms ? listCardioTemplates(id) : [],
      friend.sharesPrograms ? listWorkoutScores(id, completed.map((workout) => workout.id)) : null,
    ]);

    return adminJson({
      profile: { id, name: friend.name, email: friend.email, heightCm: friend.heightCm, weightKg: friend.weightKg },
      workouts: completed.map(({ id, name, startedAt, finishedAt, setCount, tonnageKg }) => ({
        id, name, startedAt, finishedAt, setCount, tonnageKg, score: scores?.get(id) ?? null,
      })),
      templates: sortTemplatesForFlow(mergeTemplateList(strength, circuit, cardio)).map((template) => ({
        id: template.id,
        format: template.format,
        name: template.name,
        meta: formatTemplateMeta(template),
      })),
    });
  });
}
