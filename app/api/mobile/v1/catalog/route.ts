import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { listExercises, listMuscleGroups } from "@/lib/repos/exercises.repo";
import { createTemplate } from "@/lib/repos/templates.repo";
import { templateInputSchema } from "@/server/schemas/templates";

const inputSchema = templateInputSchema.extend({
  accountId: z.string().min(1).max(128),
  templateId: z.uuid(),
});

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const [exercises, groups] = await Promise.all([listExercises(user.id), listMuscleGroups()]);
  return json({
    exercises: exercises.map(({ id, nameRu, nameEn, description, primaryMuscles, isCustom }) => ({
      id, nameRu, nameEn, description, primaryMuscles, isCustom,
    })),
    muscles: groups.map(({ key, nameRu }) => ({ key, nameRu })),
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") {
    return json({ error: "invalid_content_type" }, 415);
  }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_template" }, 400);
  const { accountId, templateId, ...template } = parsed.data;
  if (accountId !== user.id) return json({ error: "account_changed" }, 409);

  const available = new Set((await listExercises(user.id)).map(({ id }) => id));
  if (template.items.some(({ exerciseId }) => !available.has(exerciseId))) {
    return json({ error: "exercise_not_found" }, 404);
  }
  const { id } = await createTemplate(user.id, template, { id: templateId });
  revalidatePath("/templates");
  return json({ templateId: id });
}
