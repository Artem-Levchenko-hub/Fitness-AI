import { ArrowRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";

export const metadata: Metadata = { title: "Главная" };

export default async function DashboardPage() {
  const user = await requireUser();
  const name = user.name?.split(" ")[0] ?? user.email.split("@")[0];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <header className="mb-8">
        <p className="text-muted-foreground text-sm">Привет,</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {name}
        </h1>
      </header>

      <section className="bg-card text-card-foreground border-border mb-6 rounded-2xl border p-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Готовы тренироваться?
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Чтобы начать, создайте шаблон тренировки. Внесите упражнения, целевые
          подходы и повторения — и сможете запустить сессию одним касанием.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild size="lg" className="flex-1">
            <Link href="/templates/new">
              <Plus className="size-4" />
              Создать шаблон
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="flex-1">
            <Link href="/exercises">
              Каталог упражнений
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <p className="text-muted-foreground/70 px-1 text-xs">
        Phase 1 · скелет приложения. Полноценный flow появится в Phase 2 и 3.
      </p>
    </main>
  );
}
