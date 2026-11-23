export const MAIN_TABS = [
  { href: "/dashboard", label: "Главная", relatedPaths: [] },
  {
    href: "/workouts", label: "Тренировки",
    relatedPaths: ["/create", "/templates", "/programs", "/library", "/circuits", "/cardio", "/exercises"],
  },
  { href: "/stats", label: "Прогресс", relatedPaths: ["/body", "/sleep", "/nutrition"] },
  {
    href: "/profile", label: "Профиль",
    relatedPaths: ["/records", "/settings", "/billing", "/friends", "/admin", "/schedule", "/notes"],
  },
] as const;

export function mainTabIndex(pathname: string): number {
  return MAIN_TABS.findIndex(tab => [tab.href, ...tab.relatedPaths].some(
    path => pathname === path || pathname.startsWith(`${path}/`),
  ));
}

export function rootTabIndex(pathname: string): number {
  return MAIN_TABS.findIndex(tab => pathname === tab.href);
}

/** A slow drag needs deliberate distance; a short flick also needs velocity. */
export function swipeTarget(index: number, dx: number, dy: number, elapsedMs: number, width: number): number | null {
  if (Math.abs(dx) < Math.abs(dy) * 1.35) return null;
  const distance = Math.min(96, Math.max(56, width * 0.18));
  const flick = Math.abs(dx) >= 28 && elapsedMs > 0 && elapsedMs <= 320 && Math.abs(dx) / elapsedMs >= 0.55;
  if (Math.abs(dx) < distance && !flick) return null;
  const target = index + (dx < 0 ? 1 : -1);
  return target >= 0 && target < MAIN_TABS.length ? target : null;
}
