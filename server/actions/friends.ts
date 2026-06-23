"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/require-user";
import {
  acceptFriendRequest,
  findUserByEmail,
  sendFriendRequest,
  setShareProgramsWithFriends,
} from "@/lib/repos/friends.repo";
import { friendRequestSchema } from "@/server/schemas/friends";

export type FriendRequestState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/** Добавить друга по email: найти пользователя → отправить заявку.
 *  sendFriendRequest идемпотентен и сам принимает встречную заявку, поэтому
 *  сообщение об успехе обобщённое (заявка отправлена ИЛИ дружба подтверждена). */
export async function sendFriendRequestAction(
  _prev: FriendRequestState,
  formData: FormData,
): Promise<FriendRequestState> {
  const user = await requireUser();
  const parsed = friendRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Проверьте email",
    };
  }

  if (parsed.data.email === user.email.toLowerCase()) {
    return { status: "error", message: "Это ваш собственный email" };
  }

  const target = await findUserByEmail(parsed.data.email);
  if (!target) {
    return {
      status: "error",
      message: "Пользователь с таким email не найден",
    };
  }

  await sendFriendRequest(user.id, target.id);
  revalidatePath("/friends");
  return { status: "success", message: "Заявка отправлена" };
}

export async function acceptFriendRequestAction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id"));
  if (!id) throw new Error("Missing id");
  await acceptFriendRequest(user.id, id);
  revalidatePath("/friends");
}

/** Переключить «делиться программами с друзьями» (тумблер на /friends). Открывает
 *  друзьям дополнительно шаблоны/программы + оценки ИИ-тренера на странице друга
 *  (тренировки видны и так). R-7: repo правит только свою строку. */
export async function setShareProgramsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "true";
  await setShareProgramsWithFriends(user.id, enabled);
  revalidatePath("/friends");
}
