import type { CardioPresetKind } from "./presets";

/** H14.3 — сборка пресета кардио-шаблона из ввода билдера.
 *  Чистая domain-логика (R-7): без db/auth, на вход — уже-валидированная форма,
 *  на выход — нормализованные {name, preset, params} для repo-вставки в
 *  cardio_templates.planJson. params хранит ТОЛЬКО релевантные пресету поля,
 *  чтобы старт из шаблона (H14.4) воспроизвёл те же блоки через
 *  presetToBlocks(preset, params) — зеркало startCardioFromPreset. */

/** Параметры, которые кардио-пресет реально использует (см. presetToBlocks).
 *  tabata/norwegian_4x4 — фиксированные, params пустой. */
export type CardioTemplateParams = {
  rounds?: number;
  workSec?: number;
  restSec?: number;
  emomRounds?: number;
};

export type CardioTemplatePresetInput = {
  name: string;
  preset: CardioPresetKind;
  rounds?: number | null;
  workSec?: number | null;
  restSec?: number | null;
  emomRounds?: number | null;
};

export type CardioTemplatePreset = {
  name: string;
  preset: CardioPresetKind;
  params: CardioTemplateParams;
};

/** Нормализует ввод билдера в пресет шаблона: тримит имя (пустое — ошибка,
 *  шаблон без имени не переиспользуем, столп 4), оставляет в params только
 *  поля, осмысленные для выбранного пресета (custom → rounds/workSec/restSec;
 *  emom → emomRounds; tabata/norwegian → {}). Лишние поля отбрасываются, чтобы
 *  planJson не нёс мусор и старт из шаблона был детерминирован. */
export function buildCardioTemplatePreset(
  input: CardioTemplatePresetInput,
): CardioTemplatePreset {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new Error("У кардио-шаблона должно быть имя");
  }

  const params: CardioTemplateParams = {};
  if (input.preset === "custom") {
    if (input.rounds != null) params.rounds = input.rounds;
    if (input.workSec != null) params.workSec = input.workSec;
    if (input.restSec != null) params.restSec = input.restSec;
  } else if (input.preset === "emom") {
    if (input.emomRounds != null) params.emomRounds = input.emomRounds;
  }

  return { name, preset: input.preset, params };
}
