/** H14.2/H14.4 — единая поверхность шаблонов: сливает силовые, круговые и
 *  кардио шаблоны в один список с тегом формата, отсортированный по свежести.
 *  Чистая domain-логика (R-7): без db/auth, на вход — уже-загруженные строки
 *  каждого формата, на выход — упорядоченный размеченный список для рендера.
 *  Структурные input-типы заданы локально, чтобы не тянуть repo-типы в domain. */

export type TemplateFormat = "strength" | "circuit" | "cardio";

/** Силовые и круговые шаблоны несут счёт упражнений (есть упражнения-дети). */
export type TemplateListSource = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
};

/** Кардио-шаблон НЕ имеет упражнений-детей (блоки выводятся из preset+params)
 *  → вместо exerciseCount несёт готовую мета-строку сводки интервалов. */
export type CardioTemplateListSource = {
  id: string;
  name: string;
  description: string | null;
  metaLine: string;
  updatedAt: Date;
};

export type UnifiedTemplateItem =
  | (TemplateListSource & { format: "strength" | "circuit" })
  | (CardioTemplateListSource & { format: "cardio" });

/** Размечает каждый источник своим форматом и сливает в один список,
 *  отсортированный по updatedAt по убыванию (свежие — сверху). Стабильно
 *  относительно входного порядка при равных датах. Кардио-источник опционален
 *  (default []), чтобы существующие 2-арг вызовы оставались валидными. */
export function mergeTemplateList(
  strength: TemplateListSource[],
  circuit: TemplateListSource[],
  cardio: CardioTemplateListSource[] = [],
): UnifiedTemplateItem[] {
  const tagged: UnifiedTemplateItem[] = [
    ...strength.map((t) => ({ ...t, format: "strength" as const })),
    ...circuit.map((t) => ({ ...t, format: "circuit" as const })),
    ...cardio.map((t) => ({ ...t, format: "cardio" as const })),
  ];

  return tagged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
