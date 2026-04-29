import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Войти",
  description: "Вход в Fitness SaaS по ссылке на email.",
};

type Props = {
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Fitness SaaS
        </h1>
        <p className="text-muted-foreground text-sm">
          Войдите по ссылке на email — без паролей.
        </p>
      </div>

      <LoginForm callbackUrl={callbackUrl} />

      <p className="text-muted-foreground/80 text-center text-xs leading-relaxed">
        Продолжая, вы соглашаетесь с условиями использования.
        <br />
        Регистрация автоматическая при первом входе.
      </p>
    </div>
  );
}
