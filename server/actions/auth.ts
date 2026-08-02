"use server";

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
  | { status: "sent"; email: string; callbackUrl: string };

export async function signInWithEmail(
  _prev: SignInState | null,
  formData: FormData,
): Promise<SignInState> {
  const rawEmail = formData.get("email");
  const rawCallback = formData.get("callbackUrl");

  const parsed = emailSchema.safeParse({
    email: typeof rawEmail === "string" ? rawEmail : "",
    callbackUrl: typeof rawCallback === "string" && rawCallback ? rawCallback : undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Введите email",
    };
  }

  const callbackUrl = parsed.data.callbackUrl ?? "/dashboard";

  try {
    await signIn("resend", {
      email: parsed.data.email,
      redirect: false,
      redirectTo: callbackUrl,
    });
    return { status: "sent", email: parsed.data.email, callbackUrl };
  } catch {
    // Auth.js оборачивает не все ошибки провайдера в AuthError. Например,
    // Resend validation error раньше превращался в 500 и терялся на шаге OTP.
    // Клиенту не раскрываем provider body, но всегда возвращаем явный статус.
    return {
      status: "error",
      message: "Не удалось отправить код. Попробуйте позже.",
    };
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
