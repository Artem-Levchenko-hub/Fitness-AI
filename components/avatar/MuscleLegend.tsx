"use client";

import { groupByHeatBucket } from "@/lib/domain/avatar/heat-buckets";
import { cn } from "@/lib/utils";

import type { AvatarMuscleDatum } from "./types";

/** Легенда-чипы под 3D-аватаром, сгруппированные по нагреву: перегруз / в работе
 *  / недогрет. Чип = тот же вход в дрилл, что тап по мышце (зовёт onSelect(key)),
 *  но с крупной тап-зоной (≥56px, R-41) — мелкие группы (предплечья, икры)
 *  достижимы без пиксель-хантинга по 3D-модели. Текст-ярлык + цвет-точка (не
 *  только цвет — R-41). Внизу — подпись-политика нагрева (кардио вне heat),
 *  чтобы серый аватар у кардио-юзера не читался как баг. */
export function MuscleLegend({
  data,
  selected,
  onSelect,
  pulseKey = null,
}: {
  data: AvatarMuscleDatum[];
  selected: string | null;
  onSelect: (key: string | null) => void;
  /** H6.5: ключ самой горячей группы — её чип микро-пульсирует до первого тапа,
   *  направляя взгляд на вход в дрилл. null → ничего не пульсирует. Анимация
   *  уважает prefers-reduced-motion (Tailwind motion-safe). */
  pulseKey?: string | null;
}) {
  const groups = groupByHeatBucket(data);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.bucket}>
          <p className="text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wide uppercase">
            {group.label}
          </p>
          <ul className="flex flex-wrap gap-2">
            {group.items.map((d) => (
              <li key={d.key}>
                <button
                  type="button"
                  onClick={() => onSelect(d.key)}
                  aria-pressed={selected === d.key}
                  data-pulsing={d.key === pulseKey ? "true" : undefined}
                  aria-label={`${d.label}: ${d.levelLabel}, ${d.sets} подходов за неделю`}
                  className={cn(
                    "border-border bg-card/60 hover:bg-muted aria-pressed:border-foreground/40 aria-pressed:bg-muted flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                    d.key === pulseKey &&
                      "ring-foreground/30 ring-2 motion-safe:animate-pulse",
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{d.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <p className="text-muted-foreground/70 text-[11px] leading-relaxed">
        Нагрев = подходы силовых и круговых за неделю. Кардио на цвет мышц не
        влияет.
      </p>
    </div>
  );
}
