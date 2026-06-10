import type { PeriodInsight } from "@/lib/domain/stats/period-insight";
import { periodInsightBadge } from "@/lib/domain/stats/period-insight";
import { TREND_TONE } from "@/lib/ui/trend-tone";

/** Человекочитаемая карточка-вывод над графиками `/stats` (G6): ведёт простой
 *  вердикт «растёшь/стоишь/падаешь», цифры идут следом. Цвет/иконка — общие
 *  токены тренда (TREND_TONE), как у графиков и AI-разбора. Статус передан и
 *  текстом, и иконкой — не только цветом (R-41). */
export function PeriodInsightCard({ insight }: { insight: PeriodInsight }) {
  const tone = TREND_TONE[insight.status];

  return (
    <section
      className={`mt-4 rounded-2xl border border-border p-5 ${tone.bg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight">
            {insight.headline}
          </p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {insight.detail}
          </p>
        </div>
        {insight.pct !== null ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular ${tone.text}`}
            aria-label={periodInsightBadge(insight.status)}
          >
            {tone.icon} {insight.pct > 0 ? "+" : ""}
            {insight.pct}%
          </span>
        ) : null}
      </div>
    </section>
  );
}
