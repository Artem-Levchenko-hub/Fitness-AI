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

export function swipeTarget(index: number, dx: number, dy: number, width: number, velocity = 0): number | null {
  const distance = Math.abs(dx);
  if (distance < Math.max(26, Math.abs(dy) * 1.35)) return null;
  const threshold = Math.min(96, Math.max(56, width * 0.18));
  // Project the last movement a short distance, including a turn back towards the current tab.
  const coast = Math.max(-1.2, Math.min(1.2, velocity * Math.sign(dx))) * 60;
  if (distance + coast < threshold) return null;
  const target = index + (dx < 0 ? 1 : -1);
  return target >= 0 && target < MAIN_TABS.length ? target : null;
}

export function swipeOffset(dx: number, width: number, hasNeighbor: boolean): number {
  const distance = Math.abs(dx);
  if (!hasNeighbor) return dx * 0.22 / (1 + distance / (width * 0.2));
  const direct = Math.min(distance, width * 0.36);
  const excess = distance - direct;
  return Math.sign(dx) * (direct + excess * 0.34 / (1 + excess / (width * 0.22)));
}
