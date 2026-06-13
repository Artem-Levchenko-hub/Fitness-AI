import type { CardioTemplateParams } from "./cardio-template-preset";
import type { CardioPresetKind } from "./presets";

/** H14.5c — нормализует строку кардио-шаблона (preset + planJson) в начальные
 *  значения формы редактирования. Чистая domain-логика (R-7): без db/auth, на
 *  вход — preset + снимок params, на выход — поля формы со ВСЕМИ дефолтами уже
 *  подставленными (теми же, что presetToBlocks/summarizeCardioTemplate), чтобы
 *  префилл детерминированно совпал с тем, что реально стартует из шаблона.
 *  Кардио-«билдера» нет: tabata/norwegian — править нечего кроме имени, params
 *  у них пустые; custom несёт rounds/workSec/restSec; emom — emomRounds. */
export type CardioEditInitial = {
  name: string;
  preset: CardioPresetKind;
  rounds: number;
  workSec: number;
  restSec: number;
  emomRounds: number;
};

export function toCardioEditInitial(row: {
  name: string;
  preset: CardioPresetKind;
  planJson: CardioTemplateParams | null | undefined;
}): CardioEditInitial {
  const p = row.planJson ?? {};
  return {
    name: row.name,
    preset: row.preset,
    // Дефолты зеркалят presetToBlocks (custom 6/30/60) и summarizeCardioTemplate
    // (emom 10) — несохранённое поле префиллится тем же значением, что стартует.
    rounds: p.rounds ?? 6,
    workSec: p.workSec ?? 30,
    restSec: p.restSec ?? 60,
    emomRounds: p.emomRounds ?? 10,
  };
}
