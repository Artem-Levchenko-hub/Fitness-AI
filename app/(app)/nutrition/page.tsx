import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import {
  getNutritionForDate,
  listRecentNutrition,
} from "@/lib/repos/nutrition.repo";

import { NutritionForm } from "./nutrition-form";

export const metadata: Metadata = { title: "КБЖУ" };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRu(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

export default async function NutritionPage() {
  const user = await requireUser();
  const date = todayIso();
  const [today, recent] = await Promise.all([
    getNutritionForDate(user.id, date),
    listRecentNutrition(user.id, 7),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ChevronLeft className="size-4" />
          На главную
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Питание
        </p>
        <h1 className="font-serif mt-1 text-4xl font-normal tracking-tight">
          КБЖУ сегодня
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Можно заполнить только калории или только белок — тренер использует
          то, что есть. Чем больше данных, тем точнее разбор.
        </p>
      </header>

      <section className="bg-card border-border mb-8 rounded-2xl border p-6">
        <NutritionForm
          defaultDate={date}
          defaultKcal={today?.kcal ?? null}
          defaultProtein={today?.proteinG ?? null}
          defaultFat={today?.fatG ?? null}
          defaultCarbs={today?.carbsG ?? null}
          defaultNotes={today?.notes ?? null}
        />
      </section>

      {recent.length > 0 ? (
        <section>
          <h2 className="font-serif mb-3 text-xl font-normal tracking-tight">
            Последние 7 дней
          </h2>
          <ul className="bg-card border-border divide-border divide-y rounded-2xl border">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-muted-foreground tabular text-xs">
                  {formatDateRu(r.date)}
                </span>
                <span className="tabular text-xs">
                  {r.kcal ?? "—"} ккал · Б {r.proteinG ?? "—"} · Ж{" "}
                  {r.fatG ?? "—"} · У {r.carbsG ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
