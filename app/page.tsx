import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.24em] uppercase">
        Fitness AI
      </p>

      <h1 className="font-serif max-w-2xl text-balance text-center text-5xl font-normal leading-[1.05] tracking-tight md:text-7xl">
        Тренируйся.{" "}
        <span className="text-primary italic">Запоминай.</span> Расти.
      </h1>

      <p className="text-muted-foreground max-w-md text-balance text-center text-base leading-relaxed">
        Шаблоны тренировок, фиксация подходов и AI-коуч, который читает всю
        вашу историю и подсказывает, что менять.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="px-8">
          <Link href="/login">Войти по коду</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="px-8">
          <Link href="/login">Создать аккаунт</Link>
        </Button>
      </div>

      <p className="text-muted-foreground mt-8 text-xs">
        MVP · регистрация по 6-значному коду из письма
      </p>
    </main>
  );
}
