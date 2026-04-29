"use client";

import { motion } from "framer-motion";
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
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";

  function set(value: string) {
    const next = new URLSearchParams(params);
    next.set("range", value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {PERIODS.map((p) => {
        const active = current === p.v;
        return (
          <motion.button
            key={p.v}
            type="button"
            onClick={() => set(p.v)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className={cn(
              "relative rounded-full border px-3.5 py-2 text-xs font-medium whitespace-nowrap transition-colors",
              active
                ? "text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="period-pill-bg"
                className="bg-primary absolute inset-0 -z-0 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("g") ?? "day";

  function set(value: string) {
    const next = new URLSearchParams(params);
    next.set("g", value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1.5">
      {GRANULARITY.map((p) => {
        const active = current === p.v;
        return (
          <motion.button
            key={p.v}
            type="button"
            onClick={() => set(p.v)}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className={cn(
              "relative rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "text-primary-foreground border-transparent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId="granularity-pill-bg"
                className="bg-primary absolute inset-0 -z-0 rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
      value={current}
      onChange={(e) => set(e.target.value)}
      className="bg-card border-border text-foreground hover:border-primary/40 h-9 rounded-md border px-3 text-sm transition-colors"
    >
      {exercises.map((e) => (
        <option key={e.id} value={e.id}>
          {e.nameRu}
        </option>
      ))}
    </select>
  );
}
