import { ChevronLeft, Clock, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { PRESET_META } from "@/lib/domain";
import { startCardioAction } from "@/server/actions/cardio";

import { CustomPresetForm } from "./custom-form";

export const metadata: Metadata = { title: "Новое кардио" };

export default async function NewCardioPage() {
  await requireUser();

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pt-6 pb-8 md:px-8 md:pt-10">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/cardio">
          <ChevronLeft className="size-4" />К истории
        </Link>
      </Button>

      <header className="mb-6">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
          Кардио · HIIT
        </p>
        <h1 className="font-serif mt-1 text-3xl font-normal tracking-tight md:text-4xl">
          Выбери формат
        </h1>
      </header>

      <section className="space-y-3">
        <PresetCard
          preset="tabata"
          icon={<Zap className="size-5" />}
        />
        <PresetCard
          preset="norwegian_4x4"
          icon={<Clock className="size-5" />}
        />
        <EmomCard />
        <CustomPresetForm />
      </section>
    </main>
  );
}

function PresetCard({
  preset,
  icon,
}: {
  preset: "tabata" | "norwegian_4x4";
  icon: React.ReactNode;
}) {
  const m = PRESET_META[preset];
  return (
    <form action={startCardioAction}>
      <input type="hidden" name="preset" value={preset} />
      <input type="hidden" name="name" value={m.defaultName} />
      <button
        type="submit"
        className="bg-card hover:bg-accent/40 border-border block w-full rounded-2xl border p-5 text-left transition-colors"
      >
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold tracking-tight">{m.nameRu}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {m.subtitleRu}
            </p>
            <p className="text-muted-foreground tabular mt-2 text-[10px] uppercase tracking-wide">
              Общее: {formatDuration(m.totalSec)}
            </p>
          </div>
        </div>
      </button>
    </form>
  );
}

function EmomCard() {
  const m = PRESET_META.emom;
  return (
    <form action={startCardioAction}>
      <input type="hidden" name="preset" value="emom" />
      <input type="hidden" name="name" value={m.defaultName} />
      <div className="bg-card border-border rounded-2xl border p-5">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full">
            <Clock className="size-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold tracking-tight">{m.nameRu}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {m.subtitleRu}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label
                htmlFor="emomRounds"
                className="text-muted-foreground text-[11px] uppercase tracking-wide"
              >
                Раундов
              </label>
              <input
                id="emomRounds"
                type="number"
                name="emomRounds"
                min={1}
                max={60}
                defaultValue={10}
                className="border-input bg-background tabular w-16 rounded-md border px-2 py-1 text-sm"
              />
              <Button type="submit" size="sm" className="ml-auto">
                Начать
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (s === 0) return `${m} мин`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
