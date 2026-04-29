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
        <p className="text-muted-foreground text-xs font-medium tracking-[0.2em] uppercase">
          Fitness SaaS
        </p>
        <h1 className="font-serif text-3xl font-normal tracking-tight md:text-4xl">
          С возвращением
        </h1>
        <p className="text-muted-foreground text-sm">
          Войдите по 6-значному коду из письма — без паролей.
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
