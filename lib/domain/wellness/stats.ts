import { addDaysIso } from "@/lib/datetime/iso-week";
import { localDateIso } from "@/lib/datetime/local-day";
import type { StatsRange } from "@/lib/domain/stats/range";

export type WellnessDay = { date: string; hours: number | null; proteinG: number | null };
export type WellnessRange = { from: string; to: string };

export function wellnessRange(range: StatsRange, now: Date, timeZone: string): WellnessRange {
  const to = localDateIso(now, timeZone);
  return { from: range === "all" ? "0001-01-01" : addDaysIso(to, 1 - parseInt(range, 10)), to };
}

export function buildWellnessSeries(
  sleep: { date: string; hours: number }[],
  nutrition: { date: string; proteinG: number | null }[],
  range: WellnessRange,
) {
  const inRange = (date: string) => date >= range.from && date <= range.to;
  const hours = new Map(sleep.filter((row) => inRange(row.date)).map((row) => [row.date, row.hours]));
  const protein = new Map(nutrition.filter((row) => inRange(row.date) && row.proteinG !== null).map((row) => [row.date, row.proteinG]));
  const first = range.from === "0001-01-01"
    ? [...hours.keys(), ...protein.keys()].sort()[0]
    : range.from;
  const days: WellnessDay[] = [];
  if (first) {
    for (let date = first; date <= range.to; date = addDaysIso(date, 1)) {
      days.push({ date, hours: hours.get(date) ?? null, proteinG: protein.get(date) ?? null });
    }
  }
  const sleepValues = [...hours.values()];
  const proteinValues = [...protein.values()].filter((value): value is number => value !== null);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    days, sleepDays: sleepValues.length, proteinDays: proteinValues.length,
    averageSleep: average(sleepValues), averageProtein: average(proteinValues),
  };
}

export function wellnessAchievements(counts: { sleepDays: number; proteinDays: number }) {
  return (["sleep", "protein"] as const).flatMap((kind) => ([7, 30] as const).map((days) => {
    const current = kind === "sleep" ? counts.sleepDays : counts.proteinDays;
    return { key: `${kind}-${days}`, kind, days, current, earned: current >= days };
  }));
}
