"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

const PERIODS = [
  { v: "7d", label: "7 дн" },
  { v: "30d", label: "30 дн" },
  { v: "90d", label: "90 дн" },
  { v: "365d", label: "Год" },
  { v: "all", label: "Всё" },
] as const;

const GRANULARITY = [
  { v: "day", label: "По дням" },
  { v: "week", label: "По неделям" },
] as const;

export function PeriodPills() {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";

  function set(value: string) {
    const next = new URLSearchParams(params);
    next.set("range", value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div role="group" aria-label="Период статистики" className="grid grid-cols-5 gap-1.5">
      {PERIODS.map((p) => {
        const active = current === p.v;
        return (
          <motion.button
            key={p.v}
            type="button"
            aria-pressed={active}
            onClick={() => set(p.v)}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 500, damping: 28 }
            }
            className={cn(
              "relative min-h-11 rounded-xl border px-2 py-2 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="period-pill-bg"
                className="bg-primary absolute inset-0 -z-0 rounded-full"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{p.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function GranularityPills() {
  const reduced = useReducedMotion() ?? false;
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("g") ?? "day";

  function set(value: string) {
    const next = new URLSearchParams(params);
    next.set("g", value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div role="group" aria-label="Группировка статистики" className="flex gap-1.5">
      {GRANULARITY.map((p) => {
        const active = current === p.v;
        return (
          <motion.button
            key={p.v}
            type="button"
            aria-pressed={active}
            onClick={() => set(p.v)}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 500, damping: 28 }
            }
            className={cn(
              "relative min-h-11 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="granularity-pill-bg"
                className="bg-primary absolute inset-0 -z-0 rounded-full"
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              />
            ) : null}
            <span className="relative z-10">{p.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ExerciseSelector({
  exercises,
  current,
}: {
  exercises: ReadonlyArray<{ id: string; nameRu: string }>;
  current: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function set(value: string) {
    const next = new URLSearchParams(params);
    next.set("ex", value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  if (exercises.length === 0) return null;

  return (
    <select
      aria-label="Упражнение для графика прогресса"
      value={current}
      onChange={(e) => set(e.target.value)}
      className="bg-card border-border text-foreground hover:border-primary/40 h-11 w-full min-w-0 rounded-lg border px-3 text-sm transition-colors sm:max-w-64 sm:shrink-0"
    >
      {exercises.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nameRu}
        </option>
      ))}
    </select>
  );
}
