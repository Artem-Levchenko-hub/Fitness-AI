"use client";

import { motion, useReducedMotion } from "framer-motion";

import { muscleLabel } from "@/components/app/MuscleBadges";

type Point = { muscleKey: string; volume: number };

export function MuscleVolumeBars({ data }: { data: Point[] }) {
  const reduced = useReducedMotion() ?? false;

  if (data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Нет данных за период.</p>
    );
  }
  const max = Math.max(...data.map((d) => d.volume));
  return (
    <ul className="space-y-2">
      {data.map((d, i) => {
        const pct = max > 0 ? (d.volume / max) * 100 : 0;
        return (
          <motion.li
            key={d.muscleKey}
            initial={reduced ? false : { opacity: 0, x: -8 }}
            whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.32,
              delay: i * 0.03,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="group space-y-1"
          >
            <div className="flex items-baseline justify-between text-sm">
              <span className="group-hover:text-primary font-medium transition-colors">
                {muscleLabel(d.muscleKey)}
              </span>
              <span className="text-muted-foreground tabular text-xs">
                {Math.round(d.volume).toLocaleString("ru")} кг·повт
              </span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <motion.div
                className="bg-primary h-full rounded-full"
                initial={reduced ? { width: `${pct}%` } : { width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: reduced ? 0 : 0.7,
                  delay: reduced ? 0 : 0.1 + i * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
