/** ИИ-композер тренировочного плана — чистая domain-логика (R-7): без импортов
 *  из db/ai/auth. Здесь живут: форма интейка (тренер задаёт ОТКРЫТЫЕ вопросы —
 *  клиент отвечает свободным текстом), Zod-схема ответа LLM, сборка промпта и
 *  санитайзер сырого плана (клампы + фильтр по реальным slug-ам каталога).
 *
 *  В отличие от готовых пресетов (lib/domain/programs/library.ts) план НЕ
 *  фиксирован — тренер читает свободные ответы клиента (цель, опыт, график,
 *  инвентарь, травмы) и подбирает упражнения, повторы, отдых и сплит тонко под
 *  него: гипертрофия / сила / выносливость / реабилитация коленей / общая форма. */

import { z } from "zod";

/** Свободные ответы клиента на открытые вопросы тренера. Всё — обычный текст;
 *  цель/график/инвентарь не структурируем, LLM сам их интерпретирует. */
export type PlanIntake = {
  /** Что хочет от тренировок (обязательно — на нём строится весь план). */
  goal: string;
  /** Опыт: как давно тренируется, что умеет. */
  experience: string;
  /** График: сколько раз в неделю и сколько времени на тренировку. */
  schedule: string;
  /** Инвентарь / где тренируется (зал, дом, гантели…). */
  equipment: string;
  /** Травмы и ограничения (колени, спина, плечо…). */
  limitations: string;
  /** Любые пожелания (упор на ягодицы, без становой…). */
  notes: string;
};

/** Zod-схема интейка для серверного экшена (валидирует payload формы). Цель —
 *  обязательна (≥2 символа), остальные открытые поля опциональны (пустая строка
 *  = «не указал», LLM выберет разумно). */
export const planIntakeSchema = z.object({
  goal: z.string().trim().min(2, "Опиши цель хотя бы парой слов").max(600),
  experience: z.string().trim().max(600),
  schedule: z.string().trim().max(600),
  equipment: z.string().trim().max(600),
  limitations: z.string().trim().max(600),
  notes: z.string().trim().max(600),
});

// --- Форма ответа LLM --- //

export type AiPlanItem = {
  exerciseSlug: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  note: string | null;
};

export type AiPlanDay = {
  name: string;
  focus: string;
  items: AiPlanItem[];
};

export type AiPlan = {
  name: string;
  description: string;
  days: AiPlanDay[];
};

/** Сырой ответ LLM (до клампов/фильтрации). Числа/строки принимаем «как есть» и
 *  чиним санитайзером — модель может вернуть мусорный slug или повтор вне диапазона. */
export const aiPlanRawSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        focus: z.string().trim().max(80).optional().default(""),
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
      }),
    )
    .min(1),
});

export type AiPlanRaw = z.infer<typeof aiPlanRawSchema>;

// Глобальные клампы — страховка от мусора, НЕ замена цель-специфичных значений
// (их даёт LLM по гайду в промпте).
const SETS_MIN = 1;
const SETS_MAX = 8;
const REPS_MIN = 1;
const REPS_MAX = 50;
const REST_MIN = 10;
const REST_MAX = 600;
const MAX_DAYS = 7;
const MAX_ITEMS_PER_DAY = 12;

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

/** Чистит сырой план: клампит числа, дропает упражнения с неизвестным slug
 *  (не из системного каталога), дропает опустевшие дни. Возвращает готовый к
 *  записи AiPlan либо null, если после чистки не осталось ни одного дня с
 *  упражнениями (тогда вызывающий показывает ошибку, а не пишет пустой план). */
export function sanitizeAiPlan(
  raw: AiPlanRaw,
  validSlugs: ReadonlySet<string>,
): AiPlan | null {
  const days: AiPlanDay[] = [];

  for (const day of raw.days.slice(0, MAX_DAYS)) {
    const items: AiPlanItem[] = [];
    for (const it of day.items.slice(0, MAX_ITEMS_PER_DAY)) {
      const slug = it.exerciseSlug.trim();
      if (!validSlugs.has(slug)) continue; // выдуманное упражнение — выкидываем

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
    }
    if (items.length === 0) continue; // день без валидных упражнений — пропускаем
    days.push({
      name: day.name.trim(),
      focus: (day.focus ?? "").trim(),
      items,
    });
  }

  if (days.length === 0) return null;

  return {
    name: raw.name.trim(),
    description: raw.description.trim(),
    days,
  };
}

// --- Сборка промпта --- //

/** Гайд по всем архетипам цели — LLM сам определяет цель из свободного ответа
 *  клиента и берёт нужные повторы/отдых/подбор. Ядро «тонкой подгонки». */
const TRAINING_GUIDE = `Подбор под цель (определи цель из ответа клиента; если целей несколько — совмести разумно: силовые дни + объёмные дни):
- Рост мышц (гипертрофия): 8–15 повторов, отдых 60–120 с, база + изоляция на каждую группу.
- Сила: 3–6 повторов на главных базовых (присед/жим/тяга), отдых 150–240 с, тяжело; немного подсобки 6–10.
- Выносливость: 15–25 повторов, отдых 30–60 с, насыщенно, акцент на многосуставные движения.
- Восстановление коленей / реабилитация: береги коленный сустав. ИЗБЕГАЙ глубоких приседов со штангой, выпадов с большой амплитудой, прыжков/плиометрики. ПРЕДПОЧИТАЙ ягодичный мост, гиперэкстензию ягодиц/бицепса бедра, жим ногами в КОНТРОЛИРУЕМОЙ амплитуде, сгибание ног, подъёмы на носки, шаги на платформу с малой высотой. Повторы 12–20, плавный темп, без боли. В note к рискованным движениям пиши «контролируй амплитуду, без боли».
- Общая форма / похудение: 8–12 повторов, отдых 90–120 с, сбалансированный фулл-боди или верх/низ.`;

/** Системная инструкция тренеру-LLM. */
export const PLAN_SYSTEM_INSTRUCTION = `Ты — опытный персональный тренер по силовой подготовке. Тебе дают СВОБОДНЫЕ ответы клиента на твои вопросы (цель, опыт, график, инвентарь, травмы, пожелания) и КАТАЛОГ доступных упражнений. Внимательно прочитай ответы и составь персональный тренировочный план — сплит из дней под цель клиента.

ЖЁСТКИЕ ПРАВИЛА:
1. Выбирай упражнения ТОЛЬКО из каталога — по точному полю slug. Никогда не выдумывай slug, которого нет в каталоге.
2. Число дней в неделю определи из ответа клиента про график. Если не указал — выбери разумно (3–4).
3. Число упражнений в дне подбирай под время сессии из ответа клиента: ~30 мин → 3–4, ~45 мин → 4–5, ~60 мин → 5–7, ~90 мин → 7–9. Если время не указано — 5–6.
4. Учитывай инвентарь из ответа: если нет зала/штанги (например, «дома с гантелями» или «только вес тела») — не давай штанговые/тренажёрные движения.
5. Учитывай травмы и ограничения — не нагружай больной сустав, подбирай безопасные альтернативы и пиши предостережение в note.
6. Повторы и отдых — по гайду цели (см. ниже).
7. Названия дней — короткие и понятные на русском («День A — Низ тела», «Жим», «Сила — верх»).

${TRAINING_GUIDE}`;

/** Форма JSON-ответа (deepseek/VseGPT не имеет responseSchema — описываем в промпте). */
export const PLAN_JSON_SHAPE = `Верни ТОЛЬКО валидный JSON, без markdown и без \`\`\`, строго по схеме:
{
  "name": <короткое название плана на русском, до 80 символов>,
  "description": <1–2 предложения: под какую цель план и ключевые предостережения, до 400 символов>,
  "days": [
    {
      "name": <название дня>,
      "focus": <на что день, 1–3 слова>,
      "items": [
        {
          "exerciseSlug": <slug ИЗ КАТАЛОГА>,
          "sets": <целое 1..8>,
          "repsMin": <целое>,
          "repsMax": <целое ≥ repsMin>,
          "restSeconds": <целое, отдых между подходами>,
          "note": <строка-подсказка ИЛИ null>
        }
      ]
    }
  ]
}
Никакого текста до или после JSON.`;

export type PlanCatalogEntry = {
  slug: string;
  nameRu: string;
  primaryMuscles: string[];
};

function intakeBlock(intake: PlanIntake): string {
  return [
    `Цель: ${intake.goal.trim()}`,
    `Опыт: ${intake.experience.trim() || "не указан"}`,
    `График (дни/неделю, время на тренировку): ${intake.schedule.trim() || "не указан"}`,
    `Инвентарь / где тренируется: ${intake.equipment.trim() || "не указан"}`,
    `Травмы и ограничения: ${intake.limitations.trim() || "нет"}`,
    `Пожелания: ${intake.notes.trim() || "нет"}`,
  ].join("\n");
}

function catalogBlock(catalog: PlanCatalogEntry[]): string {
  // Компактно: slug | Название | основные группы — чтобы LLM подбирал по смыслу.
  return catalog
    .map(
      (e) =>
        `${e.slug} | ${e.nameRu}${e.primaryMuscles.length ? ` | ${e.primaryMuscles.join(",")}` : ""}`,
    )
    .join("\n");
}

/** Пользовательский промпт: свободные ответы клиента + каталог упражнений. */
export function buildPlanComposerPrompt(
  intake: PlanIntake,
  catalog: PlanCatalogEntry[],
): string {
  return [
    "## Ответы клиента",
    intakeBlock(intake),
    "",
    "## Каталог упражнений (выбирай slug ТОЛЬКО отсюда)",
    "формат строки: slug | название | основные группы мышц",
    catalogBlock(catalog),
    "",
    "Составь план по схеме ниже.",
    PLAN_JSON_SHAPE,
  ].join("\n");
}
