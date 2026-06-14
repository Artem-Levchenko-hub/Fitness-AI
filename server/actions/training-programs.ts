"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  copyLibraryProgramToUser,
  deleteProgram,
  wrapTemplatesIntoProgram,
} from "@/lib/repos/training-programs.repo";

export type ProgramActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

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

export async function deleteProgramAction(formData: FormData) {
  const user = await requireUser();
  const programId = String(formData.get("programId") ?? "");
  if (!programId) throw new Error("Missing programId");

  await deleteProgram(user.id, programId);
  revalidatePath("/programs");
  revalidatePath("/templates");
  redirect("/templates");
}
