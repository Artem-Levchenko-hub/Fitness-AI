import {
  heatFromSets,
  heatLabel,
  muscleLabelRu,
} from "../domain/avatar/heat";

/** H5.6 — связь столпов 1 (тренер-разбор) и 2 (3D-аватар). Превращает
 *  готовый профиль нагрева аватара (абсолютные недельные подходы на 14 групп,
 *  тот же `muscleHeatProfile`, что красит мышцы на /profile) в текстовый блок
 *  для контекста AI-тренера. Чистый модуль — нет импортов db/ai/env (R-7):
 *  данные приходят готовыми, формат-логика юнит-тестируема без сети. */

/** Минимальный вход: ключ группы + эффективные недельные подходы. Подмножество
 *  MuscleHeat из stats.repo — формату не нужны top3/volume/lastTrainedAt. */
export type AvatarHeatPoint = {
  muscleKey: string;
  weeklySets: number;
};

/** Подходы в человекочитаемое число: дробные (secondary даёт 0.5) — с одним
 *  знаком, целые — без хвоста. */
function fmtSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Блок «# Аватар: недельная нагрузка по группам мышц» для промпта тренера.
 *  Перечисляет все 14 групп с числом подходов и уровнем нагрева, затем явно
 *  называет самую нагруженную и перечисляет недогруженные (0 подходов) —
 *  чтобы тренер мог сослаться на конкретную холодную зону аватара. Глубокий
 *  модуль (R-01): вся логика «что горячо / что холодно» спрятана за одной
 *  функцией. Fail-soft: пустая неделя → плейсхолдер, без «самой нагруженной». */
export function formatAvatarHeatBlock(rows: AvatarHeatPoint[]): string {
  const header = "# Аватар: недельная нагрузка по группам мышц";

  const trained = rows.filter((r) => r.weeklySets > 0);
  if (trained.length === 0) {
    return `${header}\n_(за неделю не зафиксировано рабочих подходов — все группы холодные)_`;
  }

  const lines = rows.map((r) => {
    const heat = heatFromSets(r.weeklySets);
    return `- ${muscleLabelRu(r.muscleKey)}: ${fmtSets(r.weeklySets)} подходов (${heatLabel(heat.level)})`;
  });

  // Самая нагруженная: max по weeklySets; при равенстве — первая по порядку rows
  // (rows приходят в каноническом MUSCLE_KEYS-порядке из muscleHeatProfile).
  let hottest = trained[0]!;
  for (const r of trained) {
    if (r.weeklySets > hottest.weeklySets) hottest = r;
  }

  const dormant = rows.filter((r) => r.weeklySets <= 0);
  const dormantLine =
    dormant.length > 0
      ? `Недогруженные (0 подходов за неделю): ${dormant
          .map((r) => muscleLabelRu(r.muscleKey))
          .join(", ")}.`
      : "Недогруженных групп нет — нагрузка распределена по всем зонам.";

  return [
    header,
    ...lines,
    "",
    `Самая нагруженная: ${muscleLabelRu(hottest.muscleKey)} (${fmtSets(hottest.weeklySets)} подходов).`,
    dormantLine,
    "Нагрев = абсолютные подходы за неделю (силовые + круговые, primary 1.0 / secondary 0.5); 15+ = перегрев, 0 = группа холодная на аватаре.",
  ].join("\n");
}
