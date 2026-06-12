/** H14.2 — единая поверхность шаблонов: сливает силовые и круговые шаблоны
 *  в один список с тегом формата, отсортированный по свежести.
 *  Чистая domain-логика (R-7): без db/auth, на вход — уже-загруженные строки
 *  каждого формата, на выход — упорядоченный размеченный список для рендера.
 *  Структурные input-типы заданы локально, чтобы не тянуть repo-типы в domain. */

export type TemplateFormat = "strength" | "circuit";

export type TemplateListSource = {
  id: string;
  name: string;
  description: string | null;
  exerciseCount: number;
  updatedAt: Date;
};

export type UnifiedTemplateItem = TemplateListSource & {
  format: TemplateFormat;
};

/** Размечает каждый источник своим форматом и сливает в один список,
 *  отсортированный по updatedAt по убыванию (свежие — сверху). Стабильно
 *  относительно входного порядка при равных датах. */
export function mergeTemplateList(
  strength: TemplateListSource[],
  circuit: TemplateListSource[],
): UnifiedTemplateItem[] {
  const tagged: UnifiedTemplateItem[] = [
    ...strength.map((t) => ({ ...t, format: "strength" as const })),
    ...circuit.map((t) => ({ ...t, format: "circuit" as const })),
  ];

  return tagged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
