import { getISOWeek, getISOWeekYear } from "date-fns";

/** Стабильный ключ микроцикла "YYYY-Www" (например 2026-W18). */
export function isoWeekKey(date: Date = new Date()): string {
  const week = getISOWeek(date);
  const year = getISOWeekYear(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function parseIsoWeek(
  key: string,
): { year: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}
