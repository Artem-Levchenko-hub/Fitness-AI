import { localDateIso } from "@/lib/datetime/local-day";

/** Свежесть дневника в timezone самого пользователя, а не сервера. */
export function isFreshRecoveryDay(
  value: string,
  timeZone: string,
  now = new Date(),
): boolean {
  const today = localDateIso(now, timeZone);
  const todayMs = Date.parse(`${today}T00:00:00.000Z`);
  const valueMs = Date.parse(`${value}T00:00:00.000Z`);
  const ageDays = Math.floor((todayMs - valueMs) / 86_400_000);
  return ageDays >= 0 && ageDays <= 1;
}
