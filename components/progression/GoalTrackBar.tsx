import { Target } from "lucide-react";

import type { GoalProgressView } from "@/lib/domain/progression/goal-projection";

/** H18.2 — read-only трек-бар «текущее → цель». Презентационный, без клиента.
 *  Переиспользуемый носитель прогресса к цели (карточка упражнения сейчас;
 *  строка «Прошлый раз» активной тренировки — следующий слайс, тот же компонент,
 *  не плодить второй — урок H4.3). Ширина заливки — data-driven inline style
 *  (геометрия, не цвет — R-36 про токены цвета); цвета — токены. */
export function GoalTrackBar({
  view,
  unit = "кг",
}: {
  view: GoalProgressView;
  unit?: string;
}) {
  const { current, target, pct, etaWeeks, reached } = view;
  const pctLabel = Math.round(pct * 100);

  return (
    <div data-goal-track-bar className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1.5 font-medium">
          <Target className="size-4" />
          Цель
        </span>
        <span className="tabular">
          {current !== null ? (
            <span className="text-foreground font-semibold">
              {formatNum(current)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <span className="text-muted-foreground"> / {formatNum(target)} </span>
          {unit}
        </span>
      </div>

      <div
        className="bg-muted h-2.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pctLabel}
        aria-label={`Прогресс к цели: ${pctLabel}%`}
      >
        <div
          className={`h-full rounded-full transition-[width] ${
            reached ? "bg-success" : "bg-primary"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>

      <p className="text-muted-foreground text-xs">
        {reached
          ? "Цель достигнута 🎯"
          : etaWeeks !== null
            ? `Текущим темпом ≈ ${formatEta(etaWeeks)}`
            : current !== null
              ? "Нужен рост — темпа к цели пока нет"
              : "Пока нет истории по этому упражнению"}
      </p>
    </div>
  );
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Округление недель до цели в человекочитаемую строку с плюрализацией. */
function formatEta(weeks: number): string {
  const w = Math.max(1, Math.round(weeks));
  return `${w} ${pluralWeeks(w)}`;
}

function pluralWeeks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "неделя";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "недели";
  return "недель";
}
