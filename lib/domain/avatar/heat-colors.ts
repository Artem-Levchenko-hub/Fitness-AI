import { heatColorStop, MUSCLE_KEYS, type MuscleKey } from "./heat";

/** Точка нагрева по группе мышц — минимальная форма AvatarMuscleDatum (key +
 *  уже посчитанный доменной рампой hex-цвет). Структурный параметр, чтобы домен
 *  не зависел от view-типа из components/ (R-7 — деп. направлены к стабильному). */
export type HeatColorPoint = { key: string; color: string };

const NEUTRAL = heatColorStop(0);

/** H3.5 — карта key→hex для shapeFill силуэта сравнения. Цвет берётся РОВНО как
 *  у 3D-аватара (datum.color = heatColorStop(heatFromSets(...).t)) — та же
 *  абсолютная рампа, поэтому два силуэта (мой/друга) на одной шкале и «чья
 *  группа горячее» читается напрямую. Все 14 групп всегда в выводе: отсутствует
 *  в data / неизвестный ключ → серый heatColorStop(0) (R-10/R-37 — холодное
 *  тело, не дырка в силуэте). Чистый модуль (R-7). */
export function avatarHeatColors(
  data: HeatColorPoint[],
): Record<MuscleKey, string> {
  const byKey = new Map<string, string>();
  for (const d of data) byKey.set(d.key, d.color);

  const out = {} as Record<MuscleKey, string>;
  for (const key of MUSCLE_KEYS) out[key] = byKey.get(key) ?? NEUTRAL;
  return out;
}
