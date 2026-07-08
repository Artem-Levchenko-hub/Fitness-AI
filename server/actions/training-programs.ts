"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isAiConfigured, reviewProgram } from "@/lib/ai/program-review";
import { requireUser } from "@/lib/auth/require-user";
import type { ProgramReviewResult } from "@/lib/domain/programs/program-review";
import {
  copyLibraryProgramToUser,
  deleteProgram,
  getProgramForReview,
  saveProgramReview,
  setProgramActive,
  wrapTemplatesIntoProgram,
} from "@/lib/repos/training-programs.repo";

export type ProgramActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

export type ProgramReviewActionResult =
  | { status: "success"; review: ProgramReviewResult }
  | { status: "error"; message: string };

/** Оценить программу тренером: собирает дни+упражнения+объём, зовёт LLM,
 *  кэширует результат в программу и возвращает его клиенту. AI выключен / сбой /
 *  чужая программа → ошибка (R-37) без падения. R-7: repo гейтит по userId. */
export async function reviewProgramAction(
  programId: string,
): Promise<ProgramReviewActionResult> {
  const user = await requireUser();
  if (!programId) return { status: "error", message: "Нет id программы" };

  if (!isAiConfigured()) {
    return {
      status: "error",
      message: "ИИ-тренер пока выключен. Владельцу нужно добавить ключ AI в .env.",
    };
  }

  const input = await getProgramForReview(user.id, programId);
  if (!input) return { status: "error", message: "Программа не найдена" };
  if (input.days.every((d) => d.exercises.length === 0)) {
    return {
      status: "error",
      message: "В программе нет упражнений — добавь хотя бы один день с упражнениями.",
    };
  }

  try {
    const review = await reviewProgram(input);
    await saveProgramReview(user.id, programId, review);
    revalidatePath(`/programs/${programId}`);
    return { status: "success", review };
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Не удалось оценить программу. Попробуйте ещё раз.",
    };
  }
}

/** «Использовать» программу из библиотеки → глубокая копия к себе и переход в неё.
 *  Простое form-action (без состояния): кнопка на /library/[slug]. */
export async function copyFromLibraryAction(formData: FormData) {
  const user = await requireUser();
  const librarySlug = String(formData.get("librarySlug") ?? "");
  if (!librarySlug) throw new Error("Missing librarySlug");

  const { id } = await copyLibraryProgramToUser(user.id, librarySlug);
  revalidatePath("/programs");
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  redirect(`/programs/${id}`);
}

const wrapSchema = z.object({
  name: z.string().trim().min(2, "Название от 2 символов").max(80),
  description: z.string().trim().max(500).optional().nullable(),
  templateIds: z.array(z.string().uuid()).min(1, "Выберите хотя бы один шаблон"),
});

/** Обернуть свои шаблоны в систему. useActionState-форма на /programs/new:
 *  payload — JSON {name, description?, templateIds[]}. */
export async function wrapTemplatesAction(
  _prev: ProgramActionState,
  formData: FormData,
): Promise<ProgramActionState> {
  const user = await requireUser();

  const raw = String(formData.get("payload") ?? "");
  if (!raw) return { status: "error", message: "Нет данных формы" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Не удалось разобрать данные" };
  }

  const parsed = wrapSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { status: "error", message: first?.message ?? "Проверьте поля" };
  }

  const { id } = await wrapTemplatesIntoProgram(user.id, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    templateIds: parsed.data.templateIds,
  });
  revalidatePath("/programs");
  revalidatePath("/templates");
  redirect(`/programs/${id}`);
}

/** «Начать тренироваться» — активировать систему: её дни-шаблоны появляются в
 *  общем списке «Шаблоны». Уводим туда же, чтобы атлет сразу их увидел. */
export async function activateProgramAction(formData: FormData) {
  const user = await requireUser();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) throw new Error("Missing programId");

  await setProgramActive(user.id, programId, true);
  revalidatePath("/templates");
  revalidatePath("/library");
  revalidatePath(`/programs/${programId}`);
  redirect("/templates");
}

/** Снять систему с активной — её дни прячутся из «Шаблонов» обратно на полку. */
export async function deactivateProgramAction(formData: FormData) {
  const user = await requireUser();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) throw new Error("Missing programId");

  await setProgramActive(user.id, programId, false);
  revalidatePath("/templates");
  revalidatePath("/library");
  revalidatePath(`/programs/${programId}`);
  redirect(`/programs/${programId}`);
}

export async function deleteProgramAction(formData: FormData) {
  const user = await requireUser();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) throw new Error("Missing programId");

  await deleteProgram(user.id, programId);
  revalidatePath("/programs");
  revalidatePath("/templates");
  redirect("/templates");
}
