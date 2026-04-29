"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import {
  addMeasurement,
  deleteMeasurement,
  updateUserProfile,
} from "@/lib/repos/body.repo";
import {
  bodyMeasurementSchema,
  profileSchema,
} from "@/server/schemas/body";

export type BodyState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

function parseFormData<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues?: { message?: string }[] } } },
  formData: FormData,
) {
  const obj = Object.fromEntries(formData.entries());
  return schema.safeParse(obj);
}

export async function addBodyMeasurementAction(
  _prev: BodyState,
  formData: FormData,
): Promise<BodyState> {
  const user = await requireUser();
  const parsed = bodyMeasurementSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Заполните хотя бы одну метрику",
    };
  }
  await addMeasurement(user.id, parsed.data);
  revalidatePath("/body");
  revalidatePath("/stats");
  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function deleteBodyMeasurementAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Missing id");
  await deleteMeasurement(user.id, id);
  revalidatePath("/body");
  revalidatePath("/stats");
}

export async function updateProfileAction(
  _prev: BodyState,
  formData: FormData,
): Promise<BodyState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте поля профиля",
    };
  }
  await updateUserProfile(user.id, parsed.data);
  revalidatePath("/settings");
  revalidatePath("/stats");
  return { status: "success" };
}

// Reserved for future inline form helpers
void parseFormData;
