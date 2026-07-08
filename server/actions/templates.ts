"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isAiConfigured, refineTemplate } from "@/lib/ai/template-refine";
import { requireUser } from "@/lib/auth/require-user";
import type { PlanCatalogEntry } from "@/lib/domain/programs/ai-plan";
import { listExercises } from "@/lib/repos/exercises.repo";
import { createTemplateFromWorkout } from "@/lib/repos/plan-from-history.repo";
import {
  createTemplate,
  deleteTemplate,
  getTemplateForRefine,
  getTemplateWithItems,
  revertTemplateAdaptation,
  updateTemplate,
} from "@/lib/repos/templates.repo";
import { templateInputSchema } from "@/server/schemas/templates";

export type TemplateActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; templateId: string };

const payloadSchema = z.object({
  payload: z.string().min(1),
});

function parsePayload(formData: FormData) {
  const wrapper = payloadSchema.safeParse({ payload: formData.get("payload") });
  if (!wrapper.success) return { ok: false as const, error: "Нет данных формы" };

  let json: unknown;
  try {
    json = JSON.parse(wrapper.data.payload);
  } catch {
    return { ok: false as const, error: "Не удалось разобрать данные" };
  }

  const parsed = templateInputSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false as const,
      error: first?.message ?? "Проверьте поля шаблона",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export async function createTemplateAction(
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const user = await requireUser();
  const parsed = parsePayload(formData);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const { id } = await createTemplate(user.id, parsed.data);
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect(`/templates/${id}`);
}

export async function updateTemplateAction(
  templateId: string,
  _prev: TemplateActionState,
  formData: FormData,
): Promise<TemplateActionState> {
  const user = await requireUser();
  const parsed = parsePayload(formData);
  if (!parsed.ok) return { status: "error", message: parsed.error };

  await updateTemplate(user.id, templateId, parsed.data);
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
  redirect(`/templates/${templateId}`);
}

/** «Сохранить как шаблон» с завершённой тренировки: превращает выполненное в
 *  повторяемый силовой шаблон (точная передача — templateItemsFromWorkout) и
 *  ведёт в него. Так атлет, тренирующийся по факту без шаблонов, одним тапом
 *  получает шаблон для повтора. R-7: repo гейтит по userId. Пустая тренировка
 *  (нет рабочих подходов) → возврат в неё же (нечего сохранять). */
export async function saveWorkoutAsTemplateAction(formData: FormData) {
  const user = await requireUser();
  const workoutId = String(formData.get("workoutId") ?? "");
  if (!workoutId) throw new Error("Missing workoutId");

  const created = await createTemplateFromWorkout(user.id, workoutId);
  if (!created) redirect(`/workouts/${workoutId}`);

  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect(`/templates/${created.id}`);
}

export async function deleteTemplateAction(formData: FormData) {
  const user = await requireUser();
  const templateId = String(formData.get("templateId"));
  if (!templateId) throw new Error("Missing templateId");
  await deleteTemplate(user.id, templateId);
  revalidatePath("/templates");
  redirect("/templates");
}

/** Свайп-удаление шаблона из списка (/create и /templates). В отличие от
 *  detail-кнопки НЕ редиректит — остаёмся на месте, ревалидация перерисовывает
 *  список без удалённой строки (R-7: repo гейтит по userId). */
export async function deleteTemplateFromListAction(formData: FormData) {
  const user = await requireUser();
  const templateId = String(formData.get("templateId"));
  if (!templateId) throw new Error("Missing templateId");
  await deleteTemplate(user.id, templateId);
  revalidatePath("/templates");
  revalidatePath("/create");
  revalidatePath("/dashboard");
}

export type RefineProposalItem = {
  exerciseId: string;
  nameRu: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  note: string | null;
};

export type RefineTemplateResultState =
  | {
      status: "success";
      score: number;
      assessment: string;
      changes: string[];
      items: RefineProposalItem[];
    }
  | { status: "error"; message: string };

const refineInputSchema = z.object({
  templateId: z.string().min(1),
  comment: z.string().trim().max(600),
});

/** «Оценить и улучшить с тренером»: тренер читает шаблон + комментарий атлета,
 *  даёт оценку и предлагает УЛУЧШЕННУЮ версию (по slug из каталога). НЕ пишет
 *  шаблон — только возвращает предложение (применяет applyRefinedTemplateAction).
 *  Каталог = видимые атлету упражнения (системные ∪ свои): их slug валидны, id и
 *  имена берём отсюда же. AI выключен / сбой / чужой шаблон → ошибка (R-37). */
export async function refineTemplateAction(
  input: unknown,
): Promise<RefineTemplateResultState> {
  const user = await requireUser();
  const parsed = refineInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Неверные данные" };

  if (!isAiConfigured()) {
    return {
      status: "error",
      message: "ИИ-тренер пока выключен. Владельцу нужно добавить ключ AI в .env.",
    };
  }

  const source = await getTemplateForRefine(user.id, parsed.data.templateId);
  if (!source) return { status: "error", message: "Шаблон не найден" };

  const exercises = await listExercises(user.id);
  const catalog: PlanCatalogEntry[] = exercises.map((e) => ({
    slug: e.slug,
    nameRu: e.nameRu,
    primaryMuscles: e.primaryMuscles,
  }));
  // slug → {id, nameRu} для резолва предложения тренера в id и показа названий.
  const bySlug = new Map(exercises.map((e) => [e.slug, e]));

  try {
    const refined = await refineTemplate({
      name: source.name,
      comment: parsed.data.comment,
      current: source.current,
      catalog,
    });

    const items: RefineProposalItem[] = [];
    for (const it of refined.items) {
      const ex = bySlug.get(it.exerciseSlug);
      if (!ex) continue; // недостижимо (validSlugs=catalog), но защищаемся
      items.push({
        exerciseId: ex.id,
        nameRu: ex.nameRu,
        sets: it.sets,
        repsMin: it.repsMin,
        repsMax: it.repsMax,
        restSeconds: it.restSeconds,
        note: it.note,
      });
    }
    if (items.length === 0) {
      return { status: "error", message: "Тренер не собрал улучшение. Попробуйте ещё раз." };
    }

    return {
      status: "success",
      score: refined.score,
      assessment: refined.assessment,
      changes: refined.changes,
      items,
    };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Не удалось получить оценку тренера. Попробуйте ещё раз.",
    };
  }
}

const applyRefineSchema = z.object({
  templateId: z.string().min(1),
  items: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        sets: z.number().int().min(1).max(8),
        repsMin: z.number().int().min(1).max(50),
        repsMax: z.number().int().min(1).max(50),
        restSeconds: z.number().int().min(10).max(600),
        note: z.string().max(200).nullable(),
      }),
    )
    .min(1),
});

/** Применить улучшение тренера к шаблону: перезаписывает упражнения предложенными
 *  (сохраняя имя/описание). Все exerciseId проверяются на принадлежность видимому
 *  каталогу (системные ∪ свои) — R-7, защита от подмены id с клиента. Без
 *  redirect: клиент делает router.refresh(). */
export async function applyRefinedTemplateAction(
  input: unknown,
): Promise<{ status: "success" } | { status: "error"; message: string }> {
  const user = await requireUser();
  const parsed = applyRefineSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Неверные данные" };

  const tpl = await getTemplateWithItems(user.id, parsed.data.templateId);
  if (!tpl) return { status: "error", message: "Шаблон не найден" };

  // Валидация id: только видимые атлету упражнения (R-7 — не доверяем клиенту).
  const visible = new Set((await listExercises(user.id)).map((e) => e.id));
  const items = parsed.data.items.filter((it) => visible.has(it.exerciseId));
  if (items.length === 0) {
    return { status: "error", message: "Нет валидных упражнений для применения" };
  }

  await updateTemplate(user.id, parsed.data.templateId, {
    name: tpl.name,
    description: tpl.description,
    items: items.map((it) => ({
      exerciseId: it.exerciseId,
      targetSets: it.sets,
      targetRepsMin: it.repsMin,
      targetRepsMax: Math.max(it.repsMin, it.repsMax),
      targetWeightKg: null,
      targetRestSeconds: it.restSeconds,
      notes: it.note,
    })),
  });

  revalidatePath("/templates");
  revalidatePath(`/templates/${parsed.data.templateId}`);
  return { status: "success" };
}

/** «Отменить корректировку ИИ тренера» — вернуть оригинал шаблона из снимка и
 *  включить липкий отказ от авто-адаптации. R-7: repo гейтит по userId. Без
 *  redirect (остаёмся на detail) — ревалидация перерисует страницу без бейджа. */
export async function revertTemplateAdaptationAction(formData: FormData) {
  const user = await requireUser();
  const templateId = String(formData.get("templateId"));
  if (!templateId) throw new Error("Missing templateId");
  await revertTemplateAdaptation(user.id, templateId);
  revalidatePath("/templates");
  revalidatePath(`/templates/${templateId}`);
}
