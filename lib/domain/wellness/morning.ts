import { addDaysIso } from "@/lib/datetime/iso-week";
import { localDateIso } from "@/lib/datetime/local-day";

export type MorningContext = {
  /** Last night's waking date; protein belongs to the previous intake day. */
  date: string;
  proteinDate: string;
  isMorning: boolean;
};

export function morningContext(now: Date, timeZone: string): MorningContext {
  let validTimeZone = timeZone;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(now);
  } catch {
    validTimeZone = "Europe/Moscow";
  }
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "numeric", hourCycle: "h23", timeZone: validTimeZone,
  }).format(now));
  const date = localDateIso(now, validTimeZone);
  return { date, proteinDate: addDaysIso(date, -1), isMorning: hour >= 5 && hour < 12 };
}

// Open on section entry, never above an exercise, an active session or a form.
const safeEntries = new Set([
  "/dashboard", "/stats", "/profile", "/workouts", "/circuits", "/cardio",
  "/exercises", "/templates", "/programs", "/library", "/schedule", "/records",
  "/body", "/friends", "/notes", "/settings",
]);

export function morningPromptAllowed(pathname: string): boolean {
  return safeEntries.has(pathname);
}

export function shouldShowMorningPrompt(
  context: MorningContext,
  recorded: { sleep: boolean; protein: boolean },
  dismissedDate: string | null,
): boolean {
  return context.isMorning && context.date !== dismissedDate && (!recorded.sleep || !recorded.protein);
}
