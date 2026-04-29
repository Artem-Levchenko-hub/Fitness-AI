"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import {
  createTemplate,
  deleteTemplate,
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

export async function deleteTemplateAction(formData: FormData) {
  const user = await requireUser();
  const templateId = String(formData.get("templateId"));
  if (!templateId) throw new Error("Missing templateId");
  await deleteTemplate(user.id, templateId);
  revalidatePath("/templates");
  redirect("/templates");
}
