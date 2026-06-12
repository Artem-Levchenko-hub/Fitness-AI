import type { CardioTemplateParams } from "./cardio-template-preset";
import { PRESET_META, type CardioPresetKind } from "./presets";

/** H14.4 — компактная мета-строка кардио-шаблона для единой поверхности
 *  /templates. У кардио НЕТ упражнений-детей (в отличие от силовых/круговых),
 *  поэтому вместо «N упражнений» список показывает сводку интервалов пресета.
 *  Чистая domain-логика (R-7): без db/auth, на вход — preset + снимок params
 *  (planJson), на выход — человекочитаемая строка. Толерантна к null/неполным
 *  params: подставляет те же дефолты, что presetToBlocks (детерминированно
 *  совпадает с тем, что реально стартует из шаблона). */
export function summarizeCardioTemplate(
  preset: CardioPresetKind,
  params: CardioTemplateParams | null | undefined,
): string {
  const p = params ?? {};
  switch (preset) {
    case "tabata":
      return PRESET_META.tabata.nameRu;
    case "norwegian_4x4":
      return PRESET_META.norwegian_4x4.nameRu;
    case "emom":
      return `EMOM ${p.emomRounds ?? 10} мин`;
    case "custom": {
      const rounds = p.rounds ?? 6;
      const workSec = p.workSec ?? 30;
      const restSec = p.restSec ?? 60;
      return `Свой · ${rounds}×${workSec}/${restSec}с`;
    }
  }
}
