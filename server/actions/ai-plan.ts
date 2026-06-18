"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/require-user";
import { composeAiPlan, isAiConfigured } from "@/lib/ai/plan-composer";
import {
  planIntakeSchema,
  type PlanCatalogEntry,
} from "@/lib/domain/programs/ai-plan";
import { listExercises } from "@/lib/repos/exercises.repo";
import { createAiProgramForUser } from "@/lib/repos/training-programs.repo";

export type AiPlanActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

/** Составить персональный план ИИ-тренером по ответам клиента. useActionState-
 *  форма (AiPlanBuilder): payload — JSON интейка. При успехе ведёт в созданную
 *  систему (/programs/[id]), где атлет видит дни и начинает тренироваться.
 *  AI выключен / сбой / пустой план — возвращаем ошибку (R-37), тренировки не
 *  блокируются. redirect — вне try/catch (Next реализует его через throw). */
export async function composeAiPlanAction(
  _prev: AiPlanActionState,
  formData: FormData,
): Promise<AiPlanActionState> {
  const user = await requireUser();

  if (!isAiConfigured()) {
    return {
      status: "error",
      message:
        "ИИ-тренер пока выключен. Владельцу нужно добавить ключ AI в .env и перезапустить процесс.",
    };
  }

  const raw = String(formData.get("payload") ?? "");
  if (!raw) return { status: "error", message: "Нет данных формы" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Не удалось разобрать данные формы" };
  }

  const parsed = planIntakeSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: "error", message: first?.message ?? "Проверьте ответы" };
  }

  // Каталог = только системные упражнения (ownerUserId IS NULL) — тренер
  // подбирает из них по slug, выдуманные slug санитайзер выкинет.
  const exercises = await listExercises(user.id, { scope: "system" });
  const catalog: PlanCatalogEntry[] = exercises.map((e) => ({
    slug: e.slug,
    nameRu: e.nameRu,
    primaryMuscles: e.primaryMuscles,
  }));

  if (catalog.length === 0) {
    return {
      status: "error",
      message: "Каталог упражнений пуст. Засейте системные упражнения (db:seed).",
    };
  }

  let programId: string;
  try {
    const plan = await composeAiPlan({ intake: parsed.data, catalog });
    const created = await createAiProgramForUser(user.id, plan);
    programId = created.id;
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Не удалось составить план. Попробуйте ещё раз.",
    };
  }

  revalidatePath("/library");
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect(`/programs/${programId}`);
}
