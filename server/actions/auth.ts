"use server";

import { AuthError } from "next-auth";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth";

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Введите email")
    .email("Похоже на неправильный email"),
  callbackUrl: z.string().optional(),
});

export type SignInState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; email: string };

export async function signInWithEmail(
  _prev: SignInState | null,
  formData: FormData,
): Promise<SignInState> {
  const parsed = emailSchema.safeParse({
    email: formData.get("email"),
    callbackUrl: formData.get("callbackUrl"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Введите email",
    };
  }

  try {
    await signIn("resend", {
      email: parsed.data.email,
      redirect: false,
      redirectTo: parsed.data.callbackUrl ?? "/dashboard",
    });
    return { status: "sent", email: parsed.data.email };
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        status: "error",
        message: "Не удалось отправить письмо. Попробуйте позже.",
      };
    }
    throw err;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
