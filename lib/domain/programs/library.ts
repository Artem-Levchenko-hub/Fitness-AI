/** Библиотека готовых тренировочных систем (программ) — TS-каталог, не строки БД.
 *  «Использовать» глубоко копирует пресет в строки пользователя
 *  (training-programs.repo → copyLibraryProgramToUser), сама библиотека остаётся
 *  неизменной. Прецедент каталога-данных: lib/domain/cardio/presets.ts.
 *
 *  exerciseSlug ссылается на системное упражнение (db/seed/exercises.seed.ts,
 *  ownerUserId = null). targetWeightKg = null — «подбери вес на первой
 *  тренировке»; дальше тренер адаптирует копию на месте по факту. Чистые данные
 *  (R-07) — без импортов из db/auth. */

export type LibraryLevel = "beginner" | "intermediate" | "advanced";

export type LibraryDayItem = {
  exerciseSlug: string;
  targetSets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  /** null = атлет подбирает рабочий вес на первой тренировке. */
  targetWeightKg: number | null;
  targetRestSeconds: number;
};

export type LibraryProgramDay = {
  /** Имя дня-шаблона, напр. «День A — Жим». */
  name: string;
  items: LibraryDayItem[];
};

export type LibraryProgram = {
  /** Стабильный идентификатор пресета (training_programs.librarySlug). */
  slug: string;
  name: string;
  description: string;
  level: LibraryLevel;
  /** Короткая подпись частоты, напр. «3 дня/неделю». */
  frequency: string;
  days: LibraryProgramDay[];
};

/** Хелпер: компактная запись дня. Веса нет (атлет подберёт), отдых по типу. */
const item = (
  exerciseSlug: string,
  targetSets: number,
  targetRepsMin: number,
  targetRepsMax: number,
  targetRestSeconds: number,
): LibraryDayItem => ({
  exerciseSlug,
  targetSets,
  targetRepsMin,
  targetRepsMax,
  targetWeightKg: null,
  targetRestSeconds,
});

const REST_COMPOUND = 180;
const REST_ACCESSORY = 120;
const REST_ISOLATION = 90;

export const LIBRARY_PROGRAMS: LibraryProgram[] = [
  {
    slug: "full-body-3x-beginner",
    name: "Всё тело 3 раза в неделю",
    description:
      "Простой старт для новичка: три дня в неделю на всё тело, упор на базовые движения. Добавляй вес или повторы, когда становится легко.",
    level: "beginner",
    frequency: "3 дня/неделю",
    days: [
      {
        name: "День A",
        items: [
          item("back-squat", 3, 8, 12, REST_COMPOUND),
          item("bench-press-barbell", 3, 8, 12, REST_COMPOUND),
          item("barbell-row", 3, 8, 12, REST_COMPOUND),
          item("overhead-press-dumbbell", 3, 10, 12, REST_ACCESSORY),
          item("hanging-leg-raise", 3, 10, 15, REST_ISOLATION),
        ],
      },
      {
        name: "День B",
        items: [
          item("deadlift", 3, 6, 10, REST_COMPOUND),
          item("incline-bench-press-dumbbell", 3, 8, 12, REST_COMPOUND),
          item("lat-pulldown", 3, 8, 12, REST_ACCESSORY),
          item("lateral-raise", 3, 12, 15, REST_ISOLATION),
          item("cable-crunch", 3, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "День C",
        items: [
          item("leg-press", 3, 10, 15, REST_COMPOUND),
          item("dips-chest", 3, 8, 12, REST_ACCESSORY),
          item("seated-cable-row", 3, 8, 12, REST_ACCESSORY),
          item("dumbbell-curl", 3, 10, 12, REST_ISOLATION),
          item("tricep-pushdown", 3, 10, 12, REST_ISOLATION),
        ],
      },
    ],
  },
  {
    slug: "upper-lower-4x",
    name: "Верх / Низ, 4 дня",
    description:
      "Классический сплит на четыре дня: два дня верх тела, два дня низ. Хороший объём и достаточное восстановление для среднего уровня.",
    level: "intermediate",
    frequency: "4 дня/неделю",
    days: [
      {
        name: "Верх A",
        items: [
          item("bench-press-barbell", 4, 6, 10, REST_COMPOUND),
          item("barbell-row", 4, 6, 10, REST_COMPOUND),
          item("overhead-press-barbell", 3, 8, 12, REST_ACCESSORY),
          item("lat-pulldown", 3, 10, 12, REST_ACCESSORY),
          item("dumbbell-curl", 3, 10, 12, REST_ISOLATION),
          item("tricep-pushdown", 3, 10, 12, REST_ISOLATION),
        ],
      },
      {
        name: "Низ A",
        items: [
          item("back-squat", 4, 6, 10, REST_COMPOUND),
          item("deadlift-romanian", 3, 8, 12, REST_COMPOUND),
          item("leg-press", 3, 10, 15, REST_ACCESSORY),
          item("leg-curl-lying", 3, 10, 15, REST_ISOLATION),
          item("calf-raise-standing", 4, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "Верх B",
        items: [
          item("incline-bench-press-barbell", 4, 8, 12, REST_COMPOUND),
          item("seated-cable-row", 4, 8, 12, REST_COMPOUND),
          item("arnold-press", 3, 10, 12, REST_ACCESSORY),
          item("pull-up", 3, 6, 10, REST_ACCESSORY),
          item("hammer-curl", 3, 10, 12, REST_ISOLATION),
          item("skull-crusher", 3, 10, 12, REST_ISOLATION),
        ],
      },
      {
        name: "Низ B",
        items: [
          item("front-squat", 4, 8, 12, REST_COMPOUND),
          item("hip-thrust", 3, 8, 12, REST_COMPOUND),
          item("bulgarian-split-squat", 3, 8, 12, REST_ACCESSORY),
          item("leg-curl-seated", 3, 10, 15, REST_ISOLATION),
          item("calf-raise-seated", 4, 12, 20, REST_ISOLATION),
        ],
      },
    ],
  },
  {
    slug: "push-pull-legs",
    name: "Жим / Тяга / Ноги",
    description:
      "Три дня по движениям: жимовые, тяговые, ноги. Проходишь круг дважды в неделю (6 тренировок) или один раз — как успеваешь восстанавливаться.",
    level: "intermediate",
    frequency: "3 дня/круг (до 6/неделю)",
    days: [
      {
        name: "Жим (грудь, плечи, трицепс)",
        items: [
          item("bench-press-barbell", 4, 6, 10, REST_COMPOUND),
          item("overhead-press-barbell", 3, 8, 12, REST_COMPOUND),
          item("incline-bench-press-dumbbell", 3, 10, 12, REST_ACCESSORY),
          item("lateral-raise", 4, 12, 15, REST_ISOLATION),
          item("tricep-pushdown", 3, 10, 15, REST_ISOLATION),
          item("overhead-tricep-extension", 3, 10, 12, REST_ISOLATION),
        ],
      },
      {
        name: "Тяга (спина, бицепс)",
        items: [
          item("deadlift", 3, 5, 8, REST_COMPOUND),
          item("pull-up", 4, 6, 10, REST_COMPOUND),
          item("barbell-row", 3, 8, 12, REST_ACCESSORY),
          item("seated-cable-row", 3, 10, 12, REST_ACCESSORY),
          item("face-pull", 3, 15, 20, REST_ISOLATION),
          item("barbell-curl", 3, 10, 12, REST_ISOLATION),
        ],
      },
      {
        name: "Ноги",
        items: [
          item("back-squat", 4, 6, 10, REST_COMPOUND),
          item("deadlift-romanian", 3, 8, 12, REST_COMPOUND),
          item("leg-press", 3, 10, 15, REST_ACCESSORY),
          item("leg-curl-lying", 3, 10, 15, REST_ISOLATION),
          item("calf-raise-standing", 4, 12, 15, REST_ISOLATION),
        ],
      },
    ],
  },
  {
    slug: "phul-4x",
    name: "PHUL — сила + объём",
    description:
      "Два дня на силу (мало повторов, тяжело) и два дня на рост мышц (больше повторов). Сочетает прибавку в силе с набором мышечной массы.",
    level: "intermediate",
    frequency: "4 дня/неделю",
    days: [
      {
        name: "Сила — верх",
        items: [
          item("bench-press-barbell", 4, 3, 5, REST_COMPOUND),
          item("barbell-row", 4, 3, 5, REST_COMPOUND),
          item("overhead-press-barbell", 3, 5, 8, REST_COMPOUND),
          item("pull-up", 3, 6, 8, REST_ACCESSORY),
          item("barbell-curl", 2, 8, 10, REST_ISOLATION),
          item("close-grip-bench-press", 2, 8, 10, REST_ISOLATION),
        ],
      },
      {
        name: "Сила — низ",
        items: [
          item("back-squat", 4, 3, 5, REST_COMPOUND),
          item("deadlift", 3, 3, 5, REST_COMPOUND),
          item("leg-press", 3, 8, 10, REST_ACCESSORY),
          item("leg-curl-lying", 3, 8, 10, REST_ISOLATION),
          item("calf-raise-standing", 4, 8, 12, REST_ISOLATION),
        ],
      },
      {
        name: "Объём — верх",
        items: [
          item("incline-bench-press-dumbbell", 4, 10, 15, REST_ACCESSORY),
          item("seated-cable-row", 4, 10, 15, REST_ACCESSORY),
          item("lateral-raise", 4, 12, 20, REST_ISOLATION),
          item("cable-crossover", 3, 12, 15, REST_ISOLATION),
          item("hammer-curl", 3, 12, 15, REST_ISOLATION),
          item("tricep-pushdown", 3, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "Объём — низ",
        items: [
          item("front-squat", 4, 10, 15, REST_ACCESSORY),
          item("deadlift-romanian", 3, 10, 15, REST_ACCESSORY),
          item("lunge-walking", 3, 10, 12, REST_ACCESSORY),
          item("leg-curl-seated", 3, 12, 15, REST_ISOLATION),
          item("calf-raise-seated", 4, 15, 20, REST_ISOLATION),
        ],
      },
    ],
  },
  {
    slug: "stronglifts-5x5",
    name: "Сила 5×5",
    description:
      "Минимализм на силу: два чередующихся дня, базовые штанговые движения по 5 подходов на 5 повторов. Каждую тренировку добавляешь немного веса.",
    level: "beginner",
    frequency: "3 тренировки/неделю (A/B чередуются)",
    days: [
      {
        name: "Тренировка A",
        items: [
          item("back-squat", 5, 5, 5, REST_COMPOUND),
          item("bench-press-barbell", 5, 5, 5, REST_COMPOUND),
          item("barbell-row", 5, 5, 5, REST_COMPOUND),
        ],
      },
      {
        name: "Тренировка B",
        items: [
          item("back-squat", 5, 5, 5, REST_COMPOUND),
          item("overhead-press-barbell", 5, 5, 5, REST_COMPOUND),
          item("deadlift", 1, 5, 5, REST_COMPOUND),
        ],
      },
    ],
  },
  {
    slug: "bro-split-5x",
    name: "Сплит по группам, 5 дней",
    description:
      "Каждый день — одна большая группа мышц: грудь, спина, плечи, руки, ноги. Много объёма на каждую группу, удобно для набора массы.",
    level: "advanced",
    frequency: "5 дней/неделю",
    days: [
      {
        name: "Грудь",
        items: [
          item("bench-press-barbell", 4, 6, 10, REST_COMPOUND),
          item("incline-bench-press-dumbbell", 4, 8, 12, REST_ACCESSORY),
          item("dips-chest", 3, 8, 12, REST_ACCESSORY),
          item("cable-crossover", 3, 12, 15, REST_ISOLATION),
          item("dumbbell-flyes", 3, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "Спина",
        items: [
          item("deadlift", 3, 5, 8, REST_COMPOUND),
          item("pull-up", 4, 6, 10, REST_COMPOUND),
          item("barbell-row", 4, 8, 12, REST_ACCESSORY),
          item("seated-cable-row", 3, 10, 12, REST_ACCESSORY),
          item("face-pull", 3, 15, 20, REST_ISOLATION),
        ],
      },
      {
        name: "Плечи",
        items: [
          item("overhead-press-barbell", 4, 6, 10, REST_COMPOUND),
          item("arnold-press", 3, 10, 12, REST_ACCESSORY),
          item("lateral-raise", 4, 12, 20, REST_ISOLATION),
          item("rear-delt-fly", 3, 12, 20, REST_ISOLATION),
          item("shrug-dumbbell", 3, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "Руки",
        items: [
          item("barbell-curl", 4, 8, 12, REST_ACCESSORY),
          item("close-grip-bench-press", 4, 8, 12, REST_ACCESSORY),
          item("hammer-curl", 3, 10, 12, REST_ISOLATION),
          item("overhead-tricep-extension", 3, 10, 12, REST_ISOLATION),
          item("preacher-curl", 3, 10, 12, REST_ISOLATION),
          item("tricep-pushdown", 3, 12, 15, REST_ISOLATION),
        ],
      },
      {
        name: "Ноги",
        items: [
          item("back-squat", 4, 6, 10, REST_COMPOUND),
          item("leg-press", 4, 10, 15, REST_ACCESSORY),
          item("deadlift-romanian", 3, 8, 12, REST_ACCESSORY),
          item("leg-curl-lying", 3, 10, 15, REST_ISOLATION),
          item("calf-raise-standing", 5, 12, 20, REST_ISOLATION),
        ],
      },
    ],
  },
];

export function getLibraryProgram(slug: string): LibraryProgram | undefined {
  return LIBRARY_PROGRAMS.find((p) => p.slug === slug);
}

const LEVEL_LABELS_RU: Record<LibraryLevel, string> = {
  beginner: "Новичок",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export function levelLabelRu(level: LibraryLevel): string {
  return LEVEL_LABELS_RU[level];
}

/** Паукальная форма «день/дня/дней» для счётной конструкции (1 день, 3 дня,
 *  5 дней) — та же грамматика, что у других счётчиков (formatExerciseCount). */
export function pluralDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

/** Все уникальные slug-и упражнений каталога — для проверки, что каждый есть в
 *  системных упражнениях (тест-страховка от опечатки в slug). */
export function libraryExerciseSlugs(): string[] {
  const set = new Set<string>();
  for (const p of LIBRARY_PROGRAMS)
    for (const d of p.days) for (const i of d.items) set.add(i.exerciseSlug);
  return [...set];
}
