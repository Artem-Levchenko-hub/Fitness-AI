import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUser } from "@/lib/auth/require-user";
import { composeAiPlan, isAiConfigured } from "@/lib/ai/plan-composer";
import { claimAiCapacity, settleAiCapacity } from "@/lib/ai/guard";
import { planIntakeSchema } from "@/lib/domain/programs/ai-plan";
import { listExercises } from "@/lib/repos/exercises.repo";
import { getTemplateWithItems, listTemplates } from "@/lib/repos/templates.repo";
import {
  getProgramWithDays,
  createAiProgramForUser,
  listPrograms,
  ProgramCreationConflict,
  ProgramTemplateNotFound,
  setProgramActive,
  wrapTemplatesIntoProgram,
} from "@/lib/repos/training-programs.repo";

import { libraryGuides } from "./guides";

const accountId = z.string().min(1).max(128);
const programId = z.uuid().transform((id) => id.toLowerCase());
const action = z.discriminatedUnion("action", [
  z.object({ accountId, action: z.literal("ai_create"), clientProgramId: programId, intake: planIntakeSchema }),
  z.object({ accountId, action: z.literal("set_active"), programId, active: z.boolean() }),
  z.object({
    accountId,
    action: z.literal("create"),
    clientProgramId: programId,
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).optional(),
    templateIds: z.array(programId).min(1).refine((ids) => new Set(ids).size === ids.length),
  }),
]);

function json(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);

  const query = new URL(request.url).searchParams;
  if (query.get("ai") === "1") return json({ accountId: user.id, aiConfigured: isAiConfigured() });
  const articleId = query.get("articleId");
  if (articleId !== null) {
    const article = libraryGuides.find(({ id }) => id === articleId);
    if (!article) return json({ error: "article_not_found" }, 404);
    return json({ accountId: user.id, article });
  }

  const id = query.get("programId");
  const dayId = query.get("dayId");
  if ((id !== null && !programId.safeParse(id).success)
    || (dayId !== null && (!id || !programId.safeParse(dayId).success))) {
    return json({ error: "invalid_program" }, 400);
  }

  if (!id) {
    if (query.get("new") === "1") {
      const templates = await listTemplates(user.id);
      return json({ accountId: user.id, templates: templates.map(({ id, name, exerciseCount }) => ({ id, name, exerciseCount })) });
    }
    const programs = await listPrograms(user.id);
    return json({
      accountId: user.id,
      programs: programs.map(({ id, name, active, dayCount }) => ({ id, name, active, dayCount })),
      articles: libraryGuides.map(({ id, title, summary }) => ({ id, title, summary })),
    });
  }

  const program = await getProgramWithDays(user.id, id.toLowerCase());
  if (!program) return json({ error: "program_not_found" }, 404);
  if (!dayId) return json({ accountId: user.id, program });

  const targetDay = program.days.find((day) => day.templateId === dayId.toLowerCase());
  if (!targetDay) return json({ error: "day_not_found" }, 404);
  const day = await getTemplateWithItems(user.id, targetDay.templateId);
  if (!day) return json({ error: "day_not_found" }, 404);
  return json({
    accountId: user.id,
    day: {
      id: day.id,
      name: day.name,
      description: day.description,
      active: program.active,
      items: day.items.map((item) => ({
        name: item.exerciseNameRu,
        sets: item.targetSets,
        repsMin: item.targetRepsMin,
        repsMax: item.targetRepsMax,
        weightKg: item.targetWeightKg,
        restSeconds: item.targetRestSeconds,
        notes: item.notes,
        myo: item.myoReps ? { miniSets: item.myoMiniSets, miniReps: item.myoMiniReps, restSeconds: item.myoMiniRestSeconds } : null,
      })),
    },
  });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return json({ error: "sign_in_required" }, 401);
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") return json({ error: "invalid_content_type" }, 415);

  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_program" }, 400);
  const input = parsed.data;
  if (input.accountId !== user.id) return json({ error: "account_changed" }, 409);

  if (input.action === "ai_create") {
    // A lost response must not generate or charge for a second plan.
    if (await getProgramWithDays(user.id, input.clientProgramId)) return json({ programId: input.clientProgramId });
    if (!isAiConfigured()) return json({ error: "ai_unavailable" }, 503);
    const capacity = await claimAiCapacity({
      userId: user.id, operation: "one_shot", requestKey: `mobile-plan:${user.id}:${input.clientProgramId}`,
    });
    if (capacity.kind === "duplicate") {
      if (await getProgramWithDays(user.id, input.clientProgramId)) return json({ programId: input.clientProgramId });
      return json({ error: "ai_request_in_progress" }, 409);
    }
    if (capacity.kind === "subscription_required") return json({ error: "subscription_required" }, 403);
    if (capacity.kind === "rate_limited") return json({ error: "ai_rate_limited", retryAfterSeconds: capacity.retryAfterSeconds }, 429);
    if (capacity.kind === "quota_exceeded") return json({ error: "ai_quota_exceeded", message: capacity.message }, 429);
    try {
      const exercises = await listExercises(user.id, { scope: "system" });
      const catalog = exercises.map(({ slug, nameRu, primaryMuscles }) => ({ slug, nameRu, primaryMuscles }));
      if (!catalog.length) {
        await settleAiCapacity(capacity.usageId, false);
        return json({ error: "exercise_catalog_empty" }, 503);
      }
      const plan = await composeAiPlan({ userId: user.id, intake: input.intake, catalog });
      const created = await createAiProgramForUser(user.id, plan, { id: input.clientProgramId });
      await settleAiCapacity(capacity.usageId, true);
      revalidatePath("/library");
      revalidatePath("/programs");
      revalidatePath("/templates");
      revalidatePath("/dashboard");
      return json({ programId: created.id });
    } catch {
      await settleAiCapacity(capacity.usageId, false);
      return json({ error: "ai_generation_failed" }, 502);
    }
  }

  if (input.action === "set_active") {
    const program = await getProgramWithDays(user.id, input.programId);
    if (!program) return json({ error: "program_not_found" }, 404);
    if (program.active !== input.active) {
      await setProgramActive(user.id, input.programId, input.active);
      revalidatePath("/templates");
      revalidatePath("/library");
      revalidatePath("/programs");
      revalidatePath(`/programs/${input.programId}`);
    }
    return json({ programId: input.programId, active: input.active });
  }

  try {
    const { id } = await wrapTemplatesIntoProgram(user.id, {
      name: input.name,
      description: input.description || null,
      templateIds: input.templateIds,
    }, { id: input.clientProgramId });
    revalidatePath("/templates");
    revalidatePath("/library");
    revalidatePath("/programs");
    return json({ programId: id });
  } catch (error) {
    if (error instanceof ProgramTemplateNotFound) return json({ error: "template_not_found" }, 404);
    if (error instanceof ProgramCreationConflict) return json({ error: "program_conflict" }, 409);
    throw error;
  }
}
