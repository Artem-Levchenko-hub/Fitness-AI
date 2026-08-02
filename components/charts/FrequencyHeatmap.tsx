"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type Point = { date: string; count: number };

/** GitHub-style heatmap: 7 строк (пн-вс) × N столбцов (недели).
 *  Цвет ячейки — интенсивность от 0 (нет тренировок) до max. */
export function FrequencyHeatmap({
  data,
  weeks = 18,
}: {
  data: Point[];
  weeks?: number;
}) {
  const counts = new Map<string, number>();
  for (const p of data) counts.set(p.date, p.count);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Старт — понедельник weeks недель назад
  const start = new Date(today);
  // 0=вс, 1=пн в JS
  const dayOfWeek = (start.getUTCDay() + 6) % 7; // 0=пн, 6=вс
  start.setUTCDate(start.getUTCDate() - dayOfWeek - (weeks - 1) * 7);

  const max = Math.max(1, ...data.map((d) => d.count));

  const cells: { date: string; count: number; col: number; row: number }[] = [];
  for (let w = 0; w < weeks; w += 1) {
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + d);
      if (date > today) continue;
      const iso = date.toISOString().slice(0, 10);
      cells.push({
        date: iso,
        count: counts.get(iso) ?? 0,
        col: w,
        row: d,
      });
    }
  }

  const countLabel = (count: number) =>
    count === 1 ? "тренировка" : count < 5 ? "тренировки" : "тренировок";

  return (
    <figure className="overflow-x-auto pb-1">
      <figcaption className="sr-only">
        Частота тренировок по дням за последние {weeks} недель
      </figcaption>
      <div
        className="grid auto-cols-min grid-flow-col gap-[3px]"
        style={{ gridTemplateRows: "repeat(7, 1fr)" }}
        aria-hidden="true"
      >
        {cells.map((c, i) => {
          const intensity = c.count === 0 ? 0 : 0.25 + 0.75 * (c.count / max);
          return (
            <motion.div
              key={c.date}
              title={`${c.date}: ${c.count} ${countLabel(c.count)}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.4, zIndex: 10 }}
              transition={{
                opacity: { duration: 0.25, delay: i * 0.0015 },
                scale: { type: "spring", stiffness: 400, damping: 28 },
              }}
              className={cn(
                "size-3 rounded-[3px]",
                c.count === 0 && "bg-muted",
              )}
              style={{
                backgroundColor:
                  c.count > 0
                    ? `color-mix(in oklch, var(--primary) ${intensity * 100}%, var(--muted))`
                    : undefined,
                gridRow: c.row + 1,
                gridColumn: c.col + 1,
              }}
            />
          );
        })}
      </div>
      <ul className="sr-only">
        {cells.map((cell) => (
          <li key={cell.date}>
            {cell.date}: {cell.count} {countLabel(cell.count)}
          </li>
        ))}
      </ul>
      <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[10px]">
        <span>0</span>
        <div className="bg-muted size-2.5 rounded-[2px]" aria-hidden="true" />
        <div
          className="size-2.5 rounded-[2px]"
          aria-hidden="true"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--primary) 35%, var(--muted))",
          }}
        />
        <div
          className="size-2.5 rounded-[2px]"
          aria-hidden="true"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--primary) 65%, var(--muted))",
          }}
        />
        <div
          className="size-2.5 rounded-[2px]"
          aria-hidden="true"
          style={{ backgroundColor: "var(--primary)" }}
        />
        <span>больше тренировок</span>
      </div>
    </figure>
  );
}
