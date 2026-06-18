/** ИИ-композер тренировочного плана — чистая domain-логика (R-7): без импортов
 *  из db/ai/auth. Здесь живут: таксономия целей/опыта/инвентаря, форма интейка
 *  («тренер задаёт вопросы»), Zod-схема ответа LLM, сборка промпта и
 *  санитайзер сырого плана (клампы + фильтр по реальным slug-ам каталога).
 *
 *  В отличие от готовых пресетов (lib/domain/programs/library.ts) план НЕ
 *  фиксирован — тренер подбирает упражнения, повторы, отдых и сплит под цель
 *  клиента: гипертрофия / сила / выносливость / реабилитация коленей / общая
 *  форма, с учётом травм, инвентаря и доступного времени. */

import { z } from "zod";

/** Цель тренировок. Несколько можно совмещать (тренер балансирует). */
export type PlanGoal =
  | "hypertrophy"
  | "strength"
  | "endurance"
  | "knee_rehab"
  | "general";

export type PlanExperience = "beginner" | "intermediate" | "advanced";

/** Доступный инвентарь — ограничивает выбор упражнений. */
export type PlanEquipment =
  | "full_gym"
  | "free_weights"
  | "dumbbells_only"
  | "bodyweight";

export const PLAN_GOALS: readonly PlanGoal[] = [
  "hypertrophy",
  "strength",
  "endurance",
  "knee_rehab",
  "general",
] as const;

export const GOAL_LABELS: Record<PlanGoal, string> = {
  hypertrophy: "Гипертрофия (рост мышц)",
  strength: "Сила",
  endurance: "Выносливость",
  knee_rehab: "Восстановление коленей",
  general: "Общая форма",
};

export const EXPERIENCE_LABELS: Record<PlanExperience, string> = {
  beginner: "Новичок",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export const EQUIPMENT_LABELS: Record<PlanEquipment, string> = {
  full_gym: "Полный зал (штанги, тренажёры, блоки)",
  free_weights: "Штанга + гантели",
  dumbbells_only: "Только гантели",
  bodyweight: "Только вес тела",
};

/** Варианты длительности сессии (мин) — определяют, сколько упражнений в дне. */
export const SESSION_MINUTES_OPTIONS = [30, 45, 60, 90] as const;
/** Допустимая частота (дней/неделю). */
export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6] as const;

/** Ответы клиента на вопросы тренера. */
export type PlanIntake = {
  goals: PlanGoal[];
  experience: PlanExperience;
  daysPerWeek: number;
  sessionMinutes: number;
  equipment: PlanEquipment;
  /** Свободный текст: травмы и ограничения (колени, спина, плечо…). */
  limitations: string;
  /** Свободный текст: любые пожелания (упор на ягодицы, без становой…). */
  notes: string;
};

/** Zod-схема интейка для серверного экшена (валидирует payload формы). */
export const planIntakeSchema = z.object({
  goals: z
    .array(z.enum([...PLAN_GOALS] as [PlanGoal, ...PlanGoal[]]))
    .min(1)
    .max(5),
  experience: z.enum(["beginner", "intermediate", "advanced"]),
  daysPerWeek: z.number().int().min(2).max(6),
  sessionMinutes: z.number().int().min(20).max(120),
  equipment: z.enum(["full_gym", "free_weights", "dumbbells_only", "bodyweight"]),
  limitations: z.string().trim().max(500),
  notes: z.string().trim().max(500),
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

/** Цель-специфичный гайд по повторам/отдыху/подбору — ядро «тонкой подгонки».
 *  Тренер совмещает несколько целей, балансируя дни. */
const GOAL_GUIDE: Record<PlanGoal, string> = {
  hypertrophy:
    "Гипертрофия: 8–15 повторов, отдых 60–120 с, умеренно-высокий объём, базовые + изолирующие движения на каждую группу.",
  strength:
    "Сила: 3–6 повторов на главных базовых (присед/жим/тяга), отдых 150–240 с, мало повторов, тяжело; добавь немного подсобки 6–10.",
  endurance:
    "Выносливость: 15–25 повторов, отдых 30–60 с, круговой/насыщенный характер, акцент на многосуставные движения и работу без длинных пауз.",
  knee_rehab:
    "ВОССТАНОВЛЕНИЕ КОЛЕНЕЙ: береги коленный сустав. ИЗБЕГАЙ глубоких приседов со штангой, выпадов с большой амплитудой, прыжков/плиометрики. ПРЕДПОЧИТАЙ ягодичный мост, гиперэкстензию ягодиц/бицепса бедра, жим ногами в КОНТРОЛИРУЕМОЙ амплитуде, сгибание ног, подъёмы на носки, шаги на платформу с малой высотой. Повторы 12–20, плавный темп, без боли. В note к рискованным упражнениям пиши «контролируй амплитуду, без боли».",
  general:
    "Общая форма: 8–12 повторов, отдых 90–120 с, сбалансированный фулл-боди или верх/низ, базовые движения на всё тело.",
};

/** Системная инструкция тренеру-LLM. */
export const PLAN_SYSTEM_INSTRUCTION = `Ты — опытный персональный тренер по силовой подготовке. Тебе дают ответы клиента (цели, опыт, частота, время, инвентарь, травмы) и КАТАЛОГ доступных упражнений. Составь персональный тренировочный план — сплит из дней под цель клиента.

ЖЁСТКИЕ ПРАВИЛА:
1. Выбирай упражнения ТОЛЬКО из каталога — по точному полю slug. Никогда не выдумывай slug, которого нет в каталоге.
2. Количество дней = ровно столько, сколько клиент готов тренироваться в неделю.
3. Число упражнений в дне подбирай под длительность сессии: ~30 мин → 3–4, ~45 мин → 4–5, ~60 мин → 5–7, ~90 мин → 7–9.
4. Учитывай инвентарь: если «только гантели» или «только вес тела» — не давай штанговые/тренажёрные движения.
5. Учитывай травмы и ограничения клиента — не нагружай больной сустав, подбирай безопасные альтернативы и пиши предостережение в note.
6. Совмещай несколько целей разумно: например, силовые дни (мало повторов) + объёмные дни (больше повторов).
7. Повторы и отдых — по гайду цели (см. ниже).
8. Названия дней — короткие и понятные на русском («День A — Низ тела», «Жим», «Сила — верх»).`;

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
  const goals = intake.goals.map((g) => GOAL_LABELS[g]).join(", ");
  const guides = intake.goals.map((g) => `- ${GOAL_GUIDE[g]}`).join("\n");
  return [
    `Цели: ${goals}`,
    `Опыт: ${EXPERIENCE_LABELS[intake.experience]}`,
    `Дней в неделю: ${intake.daysPerWeek}`,
    `Длительность сессии: ~${intake.sessionMinutes} мин`,
    `Инвентарь: ${EQUIPMENT_LABELS[intake.equipment]}`,
    `Травмы и ограничения: ${intake.limitations.trim() || "нет"}`,
    `Пожелания: ${intake.notes.trim() || "нет"}`,
    "",
    "Гайд по целям (соблюдай повторы/отдых/подбор):",
    guides,
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

/** Пользовательский промпт: ответы клиента + каталог упражнений. */
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
