import type { TrendStatus } from "@/lib/domain/progression/trend";
import type { WeekStrip } from "@/lib/domain/stats/week-strip";
import { TREND_TONE } from "@/lib/ui/trend-tone";

// Компактное превью «эта неделя» в tile-входе /stats на дашборде (H4.1):
// 7 точек-дней (тренировался/нет) + тоннаж недели + дельта к прошлой. Тяжёлый
// Recharts-график живёт в /stats — тут только снимок тех же данных (R-01:
// сложное за тапом). Презентационный (R-7) — вся логика в `buildWeekStrip`.

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

/** Дельта-процент → статус тренда (общие токены TREND_TONE, как на /stats).
 *  null (нет базы прошлой недели) → «new» — нейтрально, без «+∞%». */
function deltaStatus(deltaPct: number | null): TrendStatus {
  if (deltaPct === null) return "new";
  if (deltaPct > 0) return "improved";
  if (deltaPct < 0) return "regressed";
  return "stagnant";
}

export function WeekStripPreview({ strip }: { strip: WeekStrip }) {
  const tone = TREND_TONE[deltaStatus(strip.deltaPct)];

  return (
    <div className="mt-2" data-testid="dashboard-week-strip">
      <div className="flex items-center gap-1" aria-hidden="true">
        {strip.days.map((trained, i) => (
          <span
            key={DAY_LABELS[i]}
            className={`size-2 rounded-full ${
              trained ? "bg-primary" : "bg-muted-foreground/25"
            }`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-foreground tabular text-lg leading-none font-semibold">
          {Math.round(strip.tonnage).toLocaleString("ru-RU")}
        </span>
        <span className="text-muted-foreground text-[10px]">кг·повт</span>
        {strip.deltaPct !== null ? (
          <span
            className={`tabular text-xs font-semibold ${tone.text}`}
            data-testid="week-strip-delta"
          >
            {tone.icon} {strip.deltaPct > 0 ? "+" : ""}
            {strip.deltaPct}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
