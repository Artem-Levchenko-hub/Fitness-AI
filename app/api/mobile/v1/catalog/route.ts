import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { listExercises, listMuscleGroups } from "@/lib/repos/exercises.repo";
import { createTemplate, getTemplateWithItems, updateTemplate } from "@/lib/repos/templates.repo";
import { templateInputSchema } from "@/server/schemas/templates";

// GET returns nullable database fields; the shared form schema represents
// an unset text value as an empty string. Weight must be omitted before
// coercion: both Number(null) and Number("") would otherwise become zero.
const inputSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const input = raw as Record<string, unknown>;
  return {
    ...input,
    description: input.description === null ? "" : input.description,
    items: Array.isArray(input.items) ? input.items.map((rawItem: unknown) => {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) return rawItem;
      const item = rawItem as Record<string, unknown>;
      return {
        ...item,
        notes: item.notes === null ? "" : item.notes,
        targetWeightKg: item.targetWeightKg === null || item.targetWeightKg === "" ? undefined : item.targetWeightKg,
      };
    }) : input.items,
  };
}, templateInputSchema.extend({
  accountId: z.string().min(1).max(128),
  templateId: z.uuid(),
  action: z.enum(["create", "update"]).default("create"),
}));

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request?: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const templateId = request && new URL(request.url).searchParams.get("templateId");
  if (templateId && !z.uuid().safeParse(templateId).success) return json({ error: "invalid_template" }, 400);
  const template = templateId ? await getTemplateWithItems(user.id, templateId.toLowerCase()) : null;
  if (templateId && !template) return json({ error: "template_not_found" }, 404);
  const [exercises, groups] = await Promise.all([listExercises(user.id), listMuscleGroups()]);
  return json({
    accountId: user.id,
    ...(template ? { template } : {}),
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
  const { accountId, templateId, action, ...template } = parsed.data;
  if (accountId !== user.id) return json({ error: "account_changed" }, 409);

  const available = new Set((await listExercises(user.id)).map(({ id }) => id));
  if (template.items.some(({ exerciseId }) => !available.has(exerciseId))) {
    return json({ error: "exercise_not_found" }, 404);
  }
  if (action === "update") {
    if (!await getTemplateWithItems(user.id, templateId)) return json({ error: "template_not_found" }, 404);
    await updateTemplate(user.id, templateId, template);
  } else {
    await createTemplate(user.id, template, { id: templateId });
  }
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/library");
  return json({ templateId });
}
