import { Check, Egg, Medal, Moon } from "lucide-react";
import Link from "next/link";

import { WellnessCharts } from "@/components/stats/WellnessCharts";
import { Button } from "@/components/ui/button";
import type { StatsRange } from "@/lib/domain/stats/range";
import { buildWellnessSeries, wellnessAchievements, wellnessRange } from "@/lib/domain/wellness/stats";
import { getNutritionRange } from "@/lib/repos/nutrition.repo";
import { getSleepRange } from "@/lib/repos/sleep.repo";
import { getWellnessLoggedDays } from "@/lib/repos/wellness.repo";

export async function WellnessStats({ userId, timeZone, range }: {
  userId: string; timeZone: string; range: StatsRange;
}) {
  const dates = wellnessRange(range, new Date(), timeZone);
  const [sleep, nutrition, loggedDays] = await Promise.all([
    getSleepRange(userId, dates.from, dates.to),
    getNutritionRange(userId, dates.from, dates.to),
    getWellnessLoggedDays(userId, dates.to),
  ]);
  const summary = buildWellnessSeries(sleep, nutrition, dates);
  const achievements = wellnessAchievements(loggedDays);
  const hasData = summary.sleepDays > 0 || summary.proteinDays > 0;

  return (
    <section className="bg-card border-border mt-6 overflow-hidden rounded-3xl border" aria-labelledby="wellness-stats-title">
      <div className="p-5 sm:p-6">
        <p className="text-primary text-[10px] font-semibold tracking-[0.18em] uppercase">Восстановление и питание</p>
        <h2 id="wellness-stats-title" className="mt-1 text-lg font-semibold">Сон и белок</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">За выбранный период. Средние рассчитаны только по дням с записью.</p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-muted/40 min-w-0 rounded-2xl p-4">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs"><Moon className="size-4" aria-hidden />Средний сон</dt>
            <dd className="tabular mt-2 text-2xl font-semibold">{metric(summary.averageSleep)} <span className="text-muted-foreground text-sm font-normal">ч</span></dd>
            <p className="text-muted-foreground mt-1 text-[11px]">Дней с записью: {summary.sleepDays}</p>
          </div>
          <div className="bg-muted/40 min-w-0 rounded-2xl p-4">
            <dt className="text-muted-foreground flex items-center gap-1.5 text-xs"><Egg className="size-4" aria-hidden />Средний белок</dt>
            <dd className="tabular mt-2 text-2xl font-semibold">{metric(summary.averageProtein)} <span className="text-muted-foreground text-sm font-normal">г/день</span></dd>
            <p className="text-muted-foreground mt-1 text-[11px]">Дней с записью: {summary.proteinDays}</p>
          </div>
        </dl>

        {hasData ? <WellnessCharts data={summary.days} /> : <p className="text-muted-foreground mt-5 text-sm">Нет записей за выбранный период. Начните с одной записи сна или белка.</p>}
        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">Сон относится к дате пробуждения, белок — к дате питания. Утренний ввод белка сохраняется за вчера. Пропуски остаются пустыми.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/sleep">Записать сон</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/nutrition">Записать белок</Link></Button>
        </div>

        {hasData ? (
          <details className="border-border mt-5 border-t pt-4">
            <summary className="focus-visible:ring-ring min-h-11 cursor-pointer rounded-md py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none">История по дням</summary>
            <div className="mt-2 max-h-80 overflow-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Сон и белок за выбранный период; тире означает отсутствие записи</caption>
                <thead className="bg-muted sticky top-0"><tr><th scope="col" className="px-3 py-3 font-medium">Дата</th><th scope="col" className="px-3 py-3 font-medium">Сон, ч</th><th scope="col" className="px-3 py-3 font-medium">Белок, г</th></tr></thead>
                <tbody className="divide-border divide-y">{[...summary.days].reverse().map((day) => (
                  <tr key={day.date}><th scope="row" className="tabular px-3 py-2.5 font-normal">{day.date.split("-").reverse().join(".")}</th><td className="tabular px-3 py-2.5">{metric(day.hours)}</td><td className="tabular px-3 py-2.5">{metric(day.proteinG)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </details>
        ) : null}
      </div>

      <div className="border-border border-t p-5 sm:p-6">
        <h3 className="text-sm font-semibold">Привычка вести записи</h3>
        <p className="text-muted-foreground mt-1 text-xs">Достижения за всё время: дни с записью, подряд или с перерывами.</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {achievements.map((achievement) => {
            const label = `${achievement.kind === "sleep" ? "Сон" : "Белок"}: ${achievement.days} дней`;
            return (
              <li key={achievement.key} className={`rounded-2xl border p-3 ${achievement.earned ? "border-primary/20 bg-primary/5" : "border-border"}`}>
                {achievement.earned ? <Check className="text-primary mb-2 size-4" aria-hidden /> : <Medal className="text-muted-foreground mb-2 size-4" aria-hidden />}
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-muted-foreground mt-1 text-[11px]">{achievement.earned ? "Рубеж открыт" : `${achievement.current} из ${achievement.days}`}</p>
                <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={achievement.days} aria-valuenow={Math.min(achievement.current, achievement.days)} className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                  <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(achievement.current / achievement.days, 1) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function metric(value: number | null) {
  return value === null ? "—" : value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}
