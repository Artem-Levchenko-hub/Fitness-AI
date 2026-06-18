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
  /** Авторство — для бейджа «Тренер» (авто-«следующая тренировка»). Опционально:
   *  у круговых/кардио источника нет → трактуем как ручной. */
  source?: "manual" | "trainer";
  /** Тренер адаптировал шаблон под факт — бейдж «обновлён тренером». Опц.:
   *  у форматов без адаптации (кардио) → undefined (трактуем как false). */
  adapted?: boolean;
};

/** Кардио-шаблон НЕ имеет упражнений-детей (блоки выводятся из preset+params)
 *  → вместо exerciseCount несёт готовую мета-строку сводки интервалов. */
export type CardioTemplateListSource = {
  id: string;
  name: string;
  description: string | null;
  metaLine: string;
  updatedAt: Date;
  /** Кардио всегда ручное — поле для единообразия объединения (бейдж «Тренер»
   *  только у силовых). */
  source?: "manual" | "trainer";
  /** Кардио пока не адаптируется тренером → всегда undefined/false. Поле для
   *  единообразия объединения (бейдж «обновлён тренером»). */
  adapted?: boolean;
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

const FORMAT_LABEL: Record<TemplateFormat, string> = {
  strength: "Силовая",
  circuit: "Круговая",
  cardio: "Кардио",
};

/** Русская форма слова «упражнение» по числу (1 упражнение, 3 упражнения,
 *  5 упражнений). */
function exerciseWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "упражнение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return "упражнения";
  return "упражнений";
}

/** Счёт упражнений с правильной русской формой слова: «6 упражнений»,
 *  «1 упражнение». Без ведущего лейбла формата — для контекстов, где формат уже
 *  ясен из шапки (карточка «Силовая» на /create). */
export function formatExerciseCount(n: number): string {
  return `${n} ${exerciseWord(n)}`;
}

/** Единая мета-строка строки шаблона в стиле «Saved Workouts» (Nike Training
 *  Club): формат ведёт строку как текст (R-41 — не только цвет), затем — деталь
 *  формата: счёт упражнений у силовой/круговой, сводка интервалов у кардио
 *  (у кардио нет упражнений-детей). Пример: «Силовая · 6 упражнений»,
 *  «Кардио · Свой · 6×30/60с». */
export function formatTemplateMeta(item: UnifiedTemplateItem): string {
  const detail =
    item.format === "cardio" ? item.metaLine : formatExerciseCount(item.exerciseCount);
  return `${FORMAT_LABEL[item.format]} · ${detail}`;
}

/** Готовая строка списка силовых шаблонов на карточке «Силовая» (/create H12.2):
 *  тап ведёт в экран старта существующего шаблона `/templates/[id]` (там уже
 *  живут строка-совет H5.7 и кнопка старта), а НЕ в конструктор нового
 *  `/templates/new` — повтор шаблона за ≤2 тапа от дашборда. Формат уже задан
 *  шапкой карточки → мета без ведущего «Силовая ·». */
/** Строка раскрытого списка шаблонов на карточке формата (/create). Общий тип
 *  для всех трёх форматов — один носитель раскрытия (урок H4.3). `href` несёт
 *  только силовая (тап → экран старта `/templates/[id]`); у круговой/кардио
 *  экрана старта нет — они стартуют POST-экшеном по `id`, поэтому href опущен. */
export type TemplateCardRow = {
  id: string;
  name: string;
  meta: string;
  href?: string;
};

/** Силовая: href ведёт в экран старта существующего шаблона (повтор за ≤2 тапа),
 *  а не в конструктор. href обязателен — без формы-экшена. */
export type StrengthTemplateRow = TemplateCardRow & { href: string };

export function buildStrengthTemplateRows(
  templates: TemplateListSource[],
): StrengthTemplateRow[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    href: `/templates/${t.id}`,
    meta: formatExerciseCount(t.exerciseCount),
  }));
}

/** Круговая (H12.2-хвост): строки без href — старт идёт серверным экшеном
 *  `startCircuitFromTemplateAction` по id (зеркало /templates). Мета = счёт
 *  упражнений (формат задан шапкой карточки). Пусто → [] (R-37 → билдер). */
export function buildCircuitTemplateRows(
  templates: TemplateListSource[],
): TemplateCardRow[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    meta: formatExerciseCount(t.exerciseCount),
  }));
}

/** Кардио (H12.2-хвост): строки без href — старт через
 *  `startCardioFromTemplateAction`. Мета = готовая сводка интервалов (у кардио
 *  нет упражнений-детей). Пусто → [] (R-37 → билдер). */
export function buildCardioTemplateRows(
  templates: CardioTemplateListSource[],
): TemplateCardRow[] {
  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    meta: t.metaLine,
  }));
}
