"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import { localDateIso } from "@/lib/datetime/local-day";
import { getUserProfile } from "@/lib/repos/body.repo";
import {
  addStrengthRecord,
  deleteStrengthRecord,
} from "@/lib/repos/strength-records.repo";
import {
  deleteStrengthRecordSchema,
  strengthRecordSchema,
} from "@/server/schemas/strength-records";

export type StrengthRecordState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export async function addStrengthRecordAction(
  _previous: StrengthRecordState,
  formData: FormData,
): Promise<StrengthRecordState> {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);
  const today = localDateIso(
    new Date(),
    profile?.timezone ?? "Europe/Moscow",
  );
  const parsed = strengthRecordSchema(today).safeParse(
    Object.fromEntries(formData.entries()),
  );
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте результат",
    };
  }

  await addStrengthRecord(user.id, parsed.data);
  revalidatePath("/records");
  return { status: "success" };
}

export async function deleteStrengthRecordAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = deleteStrengthRecordSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) return;

  await deleteStrengthRecord(user.id, parsed.data.id);
  revalidatePath("/records");
}
