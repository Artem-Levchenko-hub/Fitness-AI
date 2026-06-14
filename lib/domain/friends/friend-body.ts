/** Read-only строка «рост · вес» для шапки профиля друга (H3.3).
 *  Источники: heightCm = users.heightCm (целые см), weightKg = вес последнего
 *  замера тела друга (body_measurements). Формат согласован с экраном /body:
 *  «178 см», «82.5 кг» (toFixed(1)). Оба отсутствуют/невалидны → null —
 *  шапка строку не рисует (R-37: нет фантомной пустой строки). */
export function formatFriendBodyLine(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (isPositive(heightCm)) parts.push(`${Math.round(heightCm)} см`);
  if (isPositive(weightKg)) parts.push(`${weightKg.toFixed(1)} кг`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function isPositive(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}
