/** «Улучшить шаблон с тренером» — чистая domain-логика (R-7): без импортов из
 *  db/ai/auth. Атлет пишет комментарий (что поменял и почему / чего хочет), а
 *  тренер: (1) даёт понятную оценку с учётом комментария, (2) возвращает
 *  УЛУЧШЕННУЮ версию шаблона — правит подходы/повторы/отдых, может заменить или
 *  добавить упражнение из каталога, «выжимая максимум» и уважая комментарий
 *  (например «убрал становую — болит спина» → тренер не возвращает её, а даёт
 *  безопасную альтернативу). LLM-вызов — в lib/ai/template-refine.ts. */

import { z } from "zod";

import type { PlanCatalogEntry } from "@/lib/domain/programs/ai-plan";
import type { SetScheme } from "@/lib/domain/workouts/myo-reps";

/** Упражнение текущего шаблона (то, что атлет собрал сам). */
export type RefineCurrentItem = {
  /** slug — стабильная ссылка для LLM и резолва обратно в exerciseId. */
  slug: string;
  nameRu: string;
  primaryMuscles: string[];
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetRestSeconds: number;
  setScheme?: SetScheme;
  myoMiniSets?: number;
  myoRepsPercent?: number;
  myoRestSeconds?: number;
  myoFirstRestSeconds?: number;
  note: string | null;
};

export type RefineTemplateInput = {
  name: string;
  /** Комментарий атлета тренеру — почему поменял / чего хочет. */
  comment: string;
  current: RefineCurrentItem[];
  /** Каталог, из которого тренер может брать упражнения (slug). */
  catalog: PlanCatalogEntry[];
};

/** Один элемент улучшенного шаблона (готов к записи после резолва slug→id). */
export type RefinedItem = {
  exerciseSlug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  note: string | null;
};

/** Итог: оценка тренера + улучшенная версия шаблона. */
export type RefineTemplateResult = {
  /** 0..100 — насколько хорош ТЕКУЩИЙ шаблон под цель из комментария. */
  score: number;
  /** Оценка простыми словами с учётом комментария. */
  assessment: string;
  /** Что тренер поменял и почему (простым языком). */
  changes: string[];
  /** Улучшенные упражнения (после чистки/резолва). */
  items: RefinedItem[];
};

/** Сырой ответ LLM — принимаем мягко, чиним санитайзером. */
export const refineTemplateRawSchema = z.object({
  score: z.number(),
  assessment: z.string().trim().min(1).max(600),
  changes: z.array(z.string().trim().min(1).max(300)).default([]),
  items: z
    .array(
      z.object({
        exerciseSlug: z.string().trim().min(1),
        sets: z.number(),
        repsMin: z.number(),
        repsMax: z.number(),
        restSeconds: z.number(),
        note: z.string().trim().max(160).nullish(),
      }),
    )
    .min(1),
});

export type RefineTemplateRaw = z.infer<typeof refineTemplateRawSchema>;

// Клампы — страховка от мусора (те же коридоры, что ai-plan).
const SETS_MIN = 1;
const SETS_MAX = 8;
const REPS_MIN = 1;
const REPS_MAX = 50;
const REST_MIN = 10;
const REST_MAX = 600;
const MAX_ITEMS = 14;
const MAX_CHANGES = 6;

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Чистит сырой ответ: кламп чисел, дроп упражнений с неизвестным slug (не из
 *  каталога / не из текущего шаблона), дедуп по slug (первое вхождение),
 *  обрезка. Возвращает null, если после чистки не осталось упражнений — тогда
 *  вызыватель показывает ошибку, а не пустое улучшение. */
export function sanitizeRefinedTemplate(
  raw: RefineTemplateRaw,
  validSlugs: ReadonlySet<string>,
): RefineTemplateResult | null {
  const items: RefinedItem[] = [];
  const seen = new Set<string>();
  for (const it of raw.items.slice(0, MAX_ITEMS * 2)) {
    const slug = it.exerciseSlug.trim();
    if (!validSlugs.has(slug) || seen.has(slug)) continue;
    seen.add(slug);
    const repsMin = clamp(it.repsMin, REPS_MIN, REPS_MAX);
    const repsMax = clamp(it.repsMax, repsMin, REPS_MAX);
    const note = it.note?.trim();
    items.push({
      exerciseSlug: slug,
      sets: clamp(it.sets, SETS_MIN, SETS_MAX),
      repsMin,
      repsMax,
      restSeconds: clamp(it.restSeconds, REST_MIN, REST_MAX),
      note: note ? note : null,
    });
    if (items.length >= MAX_ITEMS) break;
  }

  if (items.length === 0) return null;

  const score = Number.isFinite(raw.score)
    ? Math.min(100, Math.max(0, Math.round(raw.score)))
    : 0;

  return {
    score,
    assessment: raw.assessment.trim(),
    changes: raw.changes.slice(0, MAX_CHANGES),
    items,
  };
}

/** Системная инструкция тренеру-LLM: простой язык, оценка + улучшение с учётом
 *  комментария атлета. */
export const TEMPLATE_REFINE_SYSTEM_INSTRUCTION = `Ты — опытный персональный тренер по силовой подготовке. Говоришь ПРОСТО, как живой тренер новичку — без терминов и без ссылок на авторов/книги в скобках. Атлет собрал шаблон тренировки сам и оставил КОММЕНТАРИЙ: что поменял и почему, чего хочет. Твоя задача — прочитать комментарий, оценить текущий шаблон и вернуть УЛУЧШЕННУЮ версию. Верни СТРОГИЙ JSON по схеме, БЕЗ markdown-обёртки.

## Что делаешь
1. **Оценка (assessment, score 0..100)** — насколько текущий шаблон хорош ПОД ЦЕЛЬ ИЗ КОММЕНТАРИЯ. Конкретно, с цифрами, простыми словами. Если атлет объяснил причину правки (травма, мало времени, упор на группу) — учти её в оценке.
2. **Улучшение (items)** — выжми из тренировки максимум под комментарий: поправь подходы/повторы/отдых, при необходимости замени или добавь упражнение ИЗ КАТАЛОГА (по точному slug). УВАЖАЙ комментарий: если атлет убрал упражнение по причине (например, болит спина/колено) — НЕ возвращай его, дай безопасную альтернативу. Не раздувай тренировку без нужды — держи разумный объём (обычно 4–7 упражнений).
3. **changes** — список того, что ты поменял и почему, простыми словами С ЦИФРАМИ («Поднял жим с 3 до 4 подходов — для роста груди мало объёма», «Убрал становую по твоей просьбе, добавил гиперэкстензию — безопаснее для спины»).

## Жёсткие правила
- Упражнения ТОЛЬКО из каталога по точному slug. Не выдумывай slug. Можешь оставить упражнения атлета (они в каталоге) — если они уместны.
- Повторы/отдых — под цель из комментария: сила 3–6 повторов и отдых 150–240 с; рост мышц 8–15 и отдых 60–120 с; выносливость 15–25 и отдых 30–60 с.
- Если строка помечена MYO-REPS, это один активационный подход почти/до отказа и короткие мини-подходы с тем же весом. Не считай падение повторов ошибкой и не превращай такой блок в обычные длинные подходы только из-за короткого отдыха. Myo-reps экономит время, но не доказан как универсально лучший способ роста.
- Учитывай травмы и ограничения из комментария — не нагружай больной сустав.
- Если шаблон уже хорош — верни его почти как есть, честно скажи об этом в assessment и оставь changes коротким.

Говори по-русски, на «ты», коротко.`;

/** Форма JSON-ответа (deepseek/VseGPT без responseSchema — описываем в промпте). */
export const REFINE_JSON_SHAPE = `Верни ТОЛЬКО валидный JSON, без markdown и без \`\`\`, строго по схеме:
{
  "score": <целое 0..100 — оценка ТЕКУЩЕГО шаблона>,
  "assessment": <строка, 1–3 предложения простыми словами с учётом комментария>,
  "changes": [<строка: что поменял и почему, с цифрой>, ...],
  "items": [
    {
      "exerciseSlug": <slug ИЗ КАТАЛОГА>,
      "sets": <целое 1..8>,
      "repsMin": <целое>,
      "repsMax": <целое ≥ repsMin>,
      "restSeconds": <целое>,
      "note": <строка-подсказка ИЛИ null>
    }
  ]
}
Никакого текста до или после JSON.`;

function currentBlock(items: RefineCurrentItem[]): string {
  if (items.length === 0) return "(шаблон пуст)";
  return items
    .map((it) => {
      const groups = it.primaryMuscles.join(", ");
      const note = it.note ? ` — заметка: ${it.note}` : "";
      const scheme =
        it.setScheme === "myo_reps"
          ? `MYO-REPS: активация ${it.targetRepsMin}–${it.targetRepsMax}, затем ${it.myoMiniSets} мини-подхода по ${it.myoRepsPercent}% повторов, отдых ${it.myoFirstRestSeconds ?? 40}с до первого и ${it.myoRestSeconds}с между следующими`
          : `${it.targetSets}×${it.targetRepsMin}–${it.targetRepsMax}, отдых ${it.targetRestSeconds}с`;
      return `- slug=${it.slug} | ${it.nameRu} | ${scheme}${groups ? ` [${groups}]` : ""}${note}`;
    })
    .join("\n");
}

function catalogBlock(catalog: PlanCatalogEntry[]): string {
  return catalog
    .map(
      (e) =>
        `${e.slug} | ${e.nameRu}${e.primaryMuscles.length ? ` | ${e.primaryMuscles.join(",")}` : ""}`,
    )
    .join("\n");
}

/** Пользовательский промпт: текущий шаблон + комментарий атлета + каталог. */
export function buildRefinePrompt(input: RefineTemplateInput): string {
  return [
    `## Шаблон: ${input.name}`,
    "",
    "## Текущие упражнения",
    currentBlock(input.current),
    "",
    "## Комментарий атлета (почему поменял / чего хочет)",
    input.comment.trim() || "(без комментария — просто улучши под рост и баланс)",
    "",
    "## Каталог упражнений (выбирай slug ТОЛЬКО отсюда)",
    "формат строки: slug | название | основные группы мышц",
    catalogBlock(input.catalog),
    "",
    "Оцени и улучши шаблон по схеме ниже.",
    REFINE_JSON_SHAPE,
  ].join("\n");
}
