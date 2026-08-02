import type { Metadata } from "next";
import Link from "next/link";

import { SessionAutoRestore } from "@/components/auth/SessionAutoRestore";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Войти",
  description: "Вход в Fitness AI по коду из письма.",
};

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="space-y-6">
      <SessionAutoRestore />
      <div className="space-y-2 text-center">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Fitness AI
        </p>
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          С возвращением
        </h1>
        <p className="text-muted-foreground text-sm">
          Войдите по 6-значному коду из письма — без паролей.
        </p>
      </div>

      <LoginForm callbackUrl={callbackUrl} />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Продолжая, вы принимаете{" "}
        <Link
          href="/legal/offer"
          className="text-foreground underline underline-offset-4"
        >
          условия оферты
        </Link>{" "}
        и{" "}
        <Link
          href="/legal/privacy"
          className="text-foreground underline underline-offset-4"
        >
          политику конфиденциальности
        </Link>
        .
        <br />
        Регистрация автоматическая при первом входе.
      </p>
    </div>
  );
}
