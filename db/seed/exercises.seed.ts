/** System exercises catalogue. ownerUserId = null, isCustom = false.
 *  primary / secondary — для расчёта volume по группам мышц. */

type MuscleKey =
  | "chest"
  | "back_lats"
  | "back_traps"
  | "shoulders_front"
  | "shoulders_side"
  | "shoulders_rear"
  | "biceps"
  | "triceps"
  | "forearms"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "calves";

export type SeedExercise = {
  slug: string;
  nameRu: string;
  nameEn: string;
  description?: string;
  primary: MuscleKey[];
  secondary?: MuscleKey[];
  /** Базовая нагрузка = вес тела; введённый вес = добавка сверху. */
  isBodyweight?: boolean;
};

export const EXERCISES: SeedExercise[] = [
  // ───────── ГРУДЬ ─────────
  {
    slug: "bench-press-barbell",
    nameRu: "Жим лёжа со штангой",
    nameEn: "Barbell bench press",
    primary: ["chest"],
    secondary: ["shoulders_front", "triceps"],
  },
  {
    slug: "bench-press-dumbbell",
    nameRu: "Жим лёжа с гантелями",
    nameEn: "Dumbbell bench press",
    primary: ["chest"],
    secondary: ["shoulders_front", "triceps"],
  },
  {
    slug: "incline-bench-press-barbell",
    nameRu: "Жим лёжа на наклонной (штанга)",
    nameEn: "Incline barbell bench press",
    primary: ["chest", "shoulders_front"],
    secondary: ["triceps"],
  },
  {
    slug: "incline-bench-press-dumbbell",
    nameRu: "Жим лёжа на наклонной (гантели)",
    nameEn: "Incline dumbbell bench press",
    primary: ["chest", "shoulders_front"],
    secondary: ["triceps"],
  },
  {
    slug: "decline-bench-press",
    nameRu: "Жим лёжа на наклонной вниз",
    nameEn: "Decline bench press",
    primary: ["chest"],
    secondary: ["triceps"],
  },
  {
    slug: "dips-chest",
    nameRu: "Отжимания на брусьях (грудь)",
    nameEn: "Chest dips",
    primary: ["chest"],
    secondary: ["triceps", "shoulders_front"],
    isBodyweight: true,
  },
  {
    slug: "dumbbell-flyes",
    nameRu: "Разводка гантелей лёжа",
    nameEn: "Dumbbell flyes",
    primary: ["chest"],
  },
  {
    slug: "cable-crossover",
    nameRu: "Сведения в кроссовере",
    nameEn: "Cable crossover",
    primary: ["chest"],
  },
  {
    slug: "push-up",
    nameRu: "Отжимания от пола",
    nameEn: "Push-up",
    primary: ["chest"],
    secondary: ["shoulders_front", "triceps", "core"],
    isBodyweight: true,
  },

  // ───────── СПИНА ─────────
  {
    slug: "deadlift",
    nameRu: "Становая тяга",
    nameEn: "Deadlift",
    primary: ["back_lats", "back_traps", "glutes", "hamstrings"],
    secondary: ["quads", "core", "forearms"],
  },
  {
    slug: "deadlift-romanian",
    nameRu: "Румынская тяга",
    nameEn: "Romanian deadlift",
    primary: ["hamstrings", "glutes"],
    secondary: ["back_lats", "core"],
  },
  {
    slug: "barbell-row",
    nameRu: "Тяга штанги в наклоне",
    nameEn: "Barbell row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps", "shoulders_rear"],
  },
  {
    slug: "dumbbell-row",
    nameRu: "Тяга гантели одной рукой",
    nameEn: "One-arm dumbbell row",
    primary: ["back_lats"],
    secondary: ["biceps", "back_traps"],
  },
  {
    slug: "pull-up",
    nameRu: "Подтягивания",
    nameEn: "Pull-up",
    primary: ["back_lats"],
    secondary: ["biceps", "back_traps", "core"],
    isBodyweight: true,
  },
  {
    slug: "chin-up",
    nameRu: "Подтягивания обратным хватом",
    nameEn: "Chin-up",
    primary: ["back_lats", "biceps"],
    secondary: ["back_traps"],
    isBodyweight: true,
  },
  {
    slug: "lat-pulldown",
    nameRu: "Тяга верхнего блока",
    nameEn: "Lat pulldown",
    primary: ["back_lats"],
    secondary: ["biceps"],
  },
  {
    slug: "seated-cable-row",
    nameRu: "Тяга нижнего блока сидя",
    nameEn: "Seated cable row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps", "shoulders_rear"],
  },
  {
    slug: "t-bar-row",
    nameRu: "Тяга T-грифа",
    nameEn: "T-bar row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps", "shoulders_rear"],
  },
  {
    slug: "shrug-barbell",
    nameRu: "Шраги со штангой",
    nameEn: "Barbell shrug",
    primary: ["back_traps"],
  },
  {
    slug: "shrug-dumbbell",
    nameRu: "Шраги с гантелями",
    nameEn: "Dumbbell shrug",
    primary: ["back_traps"],
  },
  {
    slug: "face-pull",
    nameRu: "Тяга к лицу",
    nameEn: "Face pull",
    primary: ["shoulders_rear", "back_traps"],
  },

  // ───────── ПЛЕЧИ ─────────
  {
    slug: "overhead-press-barbell",
    nameRu: "Жим штанги стоя",
    nameEn: "Overhead barbell press",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps", "core"],
  },
  {
    slug: "overhead-press-dumbbell",
    nameRu: "Жим гантелей сидя",
    nameEn: "Seated dumbbell press",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps"],
  },
  {
    slug: "arnold-press",
    nameRu: "Жим Арнольда",
    nameEn: "Arnold press",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps"],
  },
  {
    slug: "lateral-raise",
    nameRu: "Махи гантелями в стороны",
    nameEn: "Dumbbell lateral raise",
    primary: ["shoulders_side"],
  },
  {
    slug: "front-raise",
    nameRu: "Подъёмы перед собой",
    nameEn: "Front raise",
    primary: ["shoulders_front"],
  },
  {
    slug: "rear-delt-fly",
    nameRu: "Разводка на задние дельты",
    nameEn: "Rear delt fly",
    primary: ["shoulders_rear"],
  },
  {
    slug: "upright-row",
    nameRu: "Тяга к подбородку",
    nameEn: "Upright row",
    primary: ["shoulders_side", "back_traps"],
  },

  // ───────── РУКИ — БИЦЕПС ─────────
  {
    slug: "barbell-curl",
    nameRu: "Подъём штанги на бицепс",
    nameEn: "Barbell curl",
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  {
    slug: "dumbbell-curl",
    nameRu: "Подъём гантелей на бицепс",
    nameEn: "Dumbbell curl",
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  {
    slug: "hammer-curl",
    nameRu: "Молоток (хаммер)",
    nameEn: "Hammer curl",
    primary: ["biceps", "forearms"],
  },
  {
    slug: "preacher-curl",
    nameRu: "Сгибания на скамье Скотта",
    nameEn: "Preacher curl",
    primary: ["biceps"],
  },
  {
    slug: "incline-dumbbell-curl",
    nameRu: "Сгибания сидя на наклонной",
    nameEn: "Incline dumbbell curl",
    primary: ["biceps"],
  },
  {
    slug: "concentration-curl",
    nameRu: "Концентрированные сгибания",
    nameEn: "Concentration curl",
    primary: ["biceps"],
  },
  {
    slug: "cable-curl",
    nameRu: "Сгибания на блоке",
    nameEn: "Cable curl",
    primary: ["biceps"],
  },

  // ───────── РУКИ — ТРИЦЕПС ─────────
  {
    slug: "close-grip-bench-press",
    nameRu: "Жим узким хватом",
    nameEn: "Close-grip bench press",
    primary: ["triceps"],
    secondary: ["chest", "shoulders_front"],
  },
  {
    slug: "skull-crusher",
    nameRu: "Французский жим (skull crusher)",
    nameEn: "Skull crusher",
    primary: ["triceps"],
  },
  {
    slug: "tricep-pushdown",
    nameRu: "Разгибания на блоке вниз",
    nameEn: "Tricep pushdown",
    primary: ["triceps"],
  },
  {
    slug: "overhead-tricep-extension",
    nameRu: "Разгибания над головой",
    nameEn: "Overhead tricep extension",
    primary: ["triceps"],
  },
  {
    slug: "dips-triceps",
    nameRu: "Отжимания на брусьях (трицепс)",
    nameEn: "Tricep dips",
    primary: ["triceps"],
    secondary: ["chest", "shoulders_front"],
    isBodyweight: true,
  },
  {
    slug: "tricep-kickback",
    nameRu: "Разгибания в наклоне (kickback)",
    nameEn: "Tricep kickback",
    primary: ["triceps"],
  },

  // ───────── ПРЕДПЛЕЧЬЯ ─────────
  {
    slug: "wrist-curl",
    nameRu: "Сгибания запястий",
    nameEn: "Wrist curl",
    primary: ["forearms"],
  },
  {
    slug: "reverse-wrist-curl",
    nameRu: "Разгибания запястий",
    nameEn: "Reverse wrist curl",
    primary: ["forearms"],
  },
  {
    slug: "farmer-walk",
    nameRu: "Прогулка фермера",
    nameEn: "Farmer's walk",
    primary: ["forearms", "back_traps"],
    secondary: ["core", "glutes"],
  },

  // ───────── НОГИ — КВАДРИЦЕПС ─────────
  {
    slug: "back-squat",
    nameRu: "Приседания со штангой",
    nameEn: "Back squat",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings", "core"],
  },
  {
    slug: "front-squat",
    nameRu: "Приседания со штангой на груди",
    nameEn: "Front squat",
    primary: ["quads"],
    secondary: ["glutes", "core"],
  },
  {
    slug: "goblet-squat",
    nameRu: "Гоблет-приседания",
    nameEn: "Goblet squat",
    primary: ["quads", "glutes"],
    secondary: ["core"],
  },
  {
    slug: "leg-press",
    nameRu: "Жим ногами в тренажёре",
    nameEn: "Leg press",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "lunge-walking",
    nameRu: "Выпады с ходьбой",
    nameEn: "Walking lunges",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "bulgarian-split-squat",
    nameRu: "Болгарские сплит-приседания",
    nameEn: "Bulgarian split squat",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "leg-extension",
    nameRu: "Разгибания ног в тренажёре",
    nameEn: "Leg extension",
    primary: ["quads"],
  },
  {
    slug: "step-up",
    nameRu: "Зашагивания на возвышение",
    nameEn: "Step-up",
    primary: ["quads", "glutes"],
  },

  // ───────── НОГИ — БИЦЕПС БЕДРА ─────────
  {
    slug: "leg-curl-lying",
    nameRu: "Сгибания ног лёжа",
    nameEn: "Lying leg curl",
    primary: ["hamstrings"],
  },
  {
    slug: "leg-curl-seated",
    nameRu: "Сгибания ног сидя",
    nameEn: "Seated leg curl",
    primary: ["hamstrings"],
  },
  {
    slug: "good-morning",
    nameRu: "Доброе утро (good morning)",
    nameEn: "Good morning",
    primary: ["hamstrings", "glutes"],
    secondary: ["back_lats"],
  },
  {
    slug: "glute-ham-raise",
    nameRu: "Glute-Ham Raise",
    nameEn: "Glute-ham raise",
    primary: ["hamstrings", "glutes"],
  },

  // ───────── НОГИ — ЯГОДИЦЫ ─────────
  {
    slug: "hip-thrust",
    nameRu: "Ягодичный мост со штангой",
    nameEn: "Barbell hip thrust",
    primary: ["glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "glute-bridge",
    nameRu: "Ягодичный мост",
    nameEn: "Glute bridge",
    primary: ["glutes"],
  },
  {
    slug: "cable-kickback",
    nameRu: "Махи назад на блоке",
    nameEn: "Cable kickback",
    primary: ["glutes"],
  },

  // ───────── НОГИ — ИКРЫ ─────────
  {
    slug: "calf-raise-standing",
    nameRu: "Подъёмы на носки стоя",
    nameEn: "Standing calf raise",
    primary: ["calves"],
  },
  {
    slug: "calf-raise-seated",
    nameRu: "Подъёмы на носки сидя",
    nameEn: "Seated calf raise",
    primary: ["calves"],
  },
  {
    slug: "donkey-calf-raise",
    nameRu: "Подъёмы на носки в наклоне (donkey)",
    nameEn: "Donkey calf raise",
    primary: ["calves"],
  },

  // ───────── КОР ─────────
  {
    slug: "plank",
    nameRu: "Планка",
    nameEn: "Plank",
    primary: ["core"],
  },
  {
    slug: "side-plank",
    nameRu: "Боковая планка",
    nameEn: "Side plank",
    primary: ["core"],
  },
  {
    slug: "hanging-leg-raise",
    nameRu: "Подъёмы ног в висе",
    nameEn: "Hanging leg raise",
    primary: ["core"],
  },
  {
    slug: "ab-wheel-rollout",
    nameRu: "Ролик для пресса",
    nameEn: "Ab wheel rollout",
    primary: ["core"],
  },
  {
    slug: "cable-crunch",
    nameRu: "Кранчи на блоке",
    nameEn: "Cable crunch",
    primary: ["core"],
  },
  {
    slug: "russian-twist",
    nameRu: "Русские скручивания",
    nameEn: "Russian twist",
    primary: ["core"],
  },
  {
    slug: "dead-bug",
    nameRu: "Dead bug",
    nameEn: "Dead bug",
    primary: ["core"],
  },
  {
    slug: "bird-dog",
    nameRu: "Bird dog",
    nameEn: "Bird dog",
    primary: ["core"],
  },

  // ───────── ОЛИМПИЙСКИЕ / ВЗРЫВНЫЕ ─────────
  {
    slug: "power-clean",
    nameRu: "Взятие на грудь (power clean)",
    nameEn: "Power clean",
    primary: ["back_traps", "glutes", "hamstrings"],
    secondary: ["quads", "shoulders_front", "core"],
  },
  {
    slug: "clean-and-jerk",
    nameRu: "Толчок (clean & jerk)",
    nameEn: "Clean & jerk",
    primary: ["quads", "glutes", "shoulders_front"],
    secondary: ["back_traps", "triceps", "core"],
  },
  {
    slug: "snatch",
    nameRu: "Рывок (snatch)",
    nameEn: "Snatch",
    primary: ["back_traps", "shoulders_side", "glutes", "hamstrings"],
    secondary: ["quads", "core"],
  },
  {
    slug: "kettlebell-swing",
    nameRu: "Махи гирей",
    nameEn: "Kettlebell swing",
    primary: ["glutes", "hamstrings"],
    secondary: ["core", "back_lats"],
  },

  // ═════════ РАСШИРЕНИЕ КАТАЛОГА ═════════

  // ───────── ГРУДЬ (доп.) ─────────
  {
    slug: "machine-chest-press",
    nameRu: "Жим от груди в тренажёре",
    nameEn: "Machine chest press",
    primary: ["chest"],
    secondary: ["shoulders_front", "triceps"],
  },
  {
    slug: "machine-incline-press",
    nameRu: "Жим в тренажёре на наклонной",
    nameEn: "Machine incline press",
    primary: ["chest", "shoulders_front"],
    secondary: ["triceps"],
  },
  {
    slug: "pec-deck",
    nameRu: "Сведение в тренажёре «бабочка»",
    nameEn: "Pec deck fly",
    primary: ["chest"],
  },
  {
    slug: "low-to-high-cable-fly",
    nameRu: "Сведение в кроссовере снизу вверх",
    nameEn: "Low-to-high cable fly",
    primary: ["chest"],
  },
  {
    slug: "high-to-low-cable-fly",
    nameRu: "Сведение в кроссовере сверху вниз",
    nameEn: "High-to-low cable fly",
    primary: ["chest"],
  },
  {
    slug: "svend-press",
    nameRu: "Жим Свенда (блины ладонями)",
    nameEn: "Svend press",
    primary: ["chest"],
  },
  {
    slug: "floor-press",
    nameRu: "Жим лёжа с пола",
    nameEn: "Floor press",
    primary: ["chest", "triceps"],
    secondary: ["shoulders_front"],
  },
  {
    slug: "incline-push-up",
    nameRu: "Отжимания от возвышения",
    nameEn: "Incline push-up",
    primary: ["chest"],
    secondary: ["shoulders_front", "triceps"],
    isBodyweight: true,
  },
  {
    slug: "decline-push-up",
    nameRu: "Отжимания с ногами на возвышении",
    nameEn: "Decline push-up",
    primary: ["chest", "shoulders_front"],
    secondary: ["triceps"],
    isBodyweight: true,
  },
  {
    slug: "diamond-push-up",
    nameRu: "Алмазные отжимания",
    nameEn: "Diamond push-up",
    primary: ["triceps"],
    secondary: ["chest", "shoulders_front"],
    isBodyweight: true,
  },

  // ───────── СПИНА (доп.) ─────────
  {
    slug: "pull-up-wide",
    nameRu: "Подтягивания широким хватом",
    nameEn: "Wide-grip pull-up",
    primary: ["back_lats"],
    secondary: ["biceps", "back_traps"],
    isBodyweight: true,
  },
  {
    slug: "neutral-grip-pull-up",
    nameRu: "Подтягивания нейтральным хватом",
    nameEn: "Neutral-grip pull-up",
    primary: ["back_lats"],
    secondary: ["biceps"],
    isBodyweight: true,
  },
  {
    slug: "pull-up-weighted",
    nameRu: "Подтягивания с весом",
    nameEn: "Weighted pull-up",
    primary: ["back_lats"],
    secondary: ["biceps", "back_traps"],
    isBodyweight: true,
  },
  {
    slug: "lat-pulldown-close",
    nameRu: "Тяга верхнего блока узким хватом",
    nameEn: "Close-grip lat pulldown",
    primary: ["back_lats"],
    secondary: ["biceps"],
  },
  {
    slug: "straight-arm-pulldown",
    nameRu: "Пуловер на блоке прямыми руками",
    nameEn: "Straight-arm pulldown",
    primary: ["back_lats"],
  },
  {
    slug: "machine-row",
    nameRu: "Горизонтальная тяга в тренажёре",
    nameEn: "Machine row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps"],
  },
  {
    slug: "chest-supported-row",
    nameRu: "Тяга лёжа на наклонной скамье",
    nameEn: "Chest-supported row",
    primary: ["back_lats", "back_traps"],
    secondary: ["shoulders_rear"],
  },
  {
    slug: "pendlay-row",
    nameRu: "Тяга Пендлея",
    nameEn: "Pendlay row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps"],
  },
  {
    slug: "meadows-row",
    nameRu: "Тяга Медоуза (лэндмайн)",
    nameEn: "Meadows row",
    primary: ["back_lats"],
    secondary: ["biceps", "forearms"],
  },
  {
    slug: "inverted-row",
    nameRu: "Австралийские подтягивания",
    nameEn: "Inverted row",
    primary: ["back_lats", "back_traps"],
    secondary: ["biceps"],
    isBodyweight: true,
  },
  {
    slug: "rack-pull",
    nameRu: "Тяга с плинтов",
    nameEn: "Rack pull",
    primary: ["back_traps", "back_lats", "glutes"],
    secondary: ["forearms"],
  },
  {
    slug: "pullover-dumbbell",
    nameRu: "Пуловер с гантелью",
    nameEn: "Dumbbell pullover",
    primary: ["back_lats"],
    secondary: ["chest"],
  },
  {
    slug: "deadlift-sumo",
    nameRu: "Становая тяга сумо",
    nameEn: "Sumo deadlift",
    primary: ["glutes", "hamstrings", "quads"],
    secondary: ["back_lats", "forearms"],
  },
  {
    slug: "deadlift-trap-bar",
    nameRu: "Становая с трэп-грифом",
    nameEn: "Trap bar deadlift",
    primary: ["quads", "glutes"],
    secondary: ["back_traps", "forearms"],
  },
  {
    slug: "deadlift-deficit",
    nameRu: "Становая с дефицита",
    nameEn: "Deficit deadlift",
    primary: ["hamstrings", "glutes", "back_lats"],
    secondary: ["core", "forearms"],
  },
  {
    slug: "hyperextension",
    nameRu: "Гиперэкстензия",
    nameEn: "Back extension",
    primary: ["hamstrings", "glutes"],
    secondary: ["back_lats"],
    isBodyweight: true,
  },
  {
    slug: "reverse-hyperextension",
    nameRu: "Обратная гиперэкстензия",
    nameEn: "Reverse hyperextension",
    primary: ["glutes", "hamstrings"],
  },

  // ───────── ПЛЕЧИ (доп.) ─────────
  {
    slug: "machine-shoulder-press",
    nameRu: "Жим плеч в тренажёре",
    nameEn: "Machine shoulder press",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps"],
  },
  {
    slug: "push-press",
    nameRu: "Швунг жимовой",
    nameEn: "Push press",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps", "quads"],
  },
  {
    slug: "cable-lateral-raise",
    nameRu: "Махи в сторону на блоке",
    nameEn: "Cable lateral raise",
    primary: ["shoulders_side"],
  },
  {
    slug: "machine-lateral-raise",
    nameRu: "Махи в стороны в тренажёре",
    nameEn: "Machine lateral raise",
    primary: ["shoulders_side"],
  },
  {
    slug: "cable-front-raise",
    nameRu: "Подъём перед собой на блоке",
    nameEn: "Cable front raise",
    primary: ["shoulders_front"],
  },
  {
    slug: "reverse-pec-deck",
    nameRu: "Обратная бабочка",
    nameEn: "Reverse pec deck",
    primary: ["shoulders_rear"],
    secondary: ["back_traps"],
  },
  {
    slug: "landmine-press",
    nameRu: "Жим лэндмайн стоя",
    nameEn: "Landmine press",
    primary: ["shoulders_front"],
    secondary: ["triceps", "chest"],
  },
  {
    slug: "pike-push-up",
    nameRu: "Отжимания «уголком»",
    nameEn: "Pike push-up",
    primary: ["shoulders_front", "shoulders_side"],
    secondary: ["triceps"],
    isBodyweight: true,
  },
  {
    slug: "handstand-push-up",
    nameRu: "Отжимания в стойке на руках",
    nameEn: "Handstand push-up",
    primary: ["shoulders_side", "shoulders_front"],
    secondary: ["triceps"],
    isBodyweight: true,
  },
  {
    slug: "cuban-press",
    nameRu: "Кубинский жим",
    nameEn: "Cuban press",
    primary: ["shoulders_rear", "shoulders_side"],
    secondary: ["back_traps"],
  },

  // ───────── БИЦЕПС (доп.) ─────────
  {
    slug: "ez-bar-curl",
    nameRu: "Подъём EZ-штанги на бицепс",
    nameEn: "EZ-bar curl",
    primary: ["biceps"],
    secondary: ["forearms"],
  },
  {
    slug: "spider-curl",
    nameRu: "Паучьи сгибания",
    nameEn: "Spider curl",
    primary: ["biceps"],
  },
  {
    slug: "reverse-curl",
    nameRu: "Обратные сгибания на бицепс",
    nameEn: "Reverse curl",
    primary: ["forearms", "biceps"],
  },
  {
    slug: "zottman-curl",
    nameRu: "Сгибания Зоттмана",
    nameEn: "Zottman curl",
    primary: ["biceps", "forearms"],
  },
  {
    slug: "rope-hammer-curl",
    nameRu: "Молотки на канате (блок)",
    nameEn: "Rope hammer curl",
    primary: ["biceps", "forearms"],
  },
  {
    slug: "machine-curl",
    nameRu: "Сгибания на бицепс в тренажёре",
    nameEn: "Machine curl",
    primary: ["biceps"],
  },
  {
    slug: "drag-curl",
    nameRu: "Тянущие сгибания (drag curl)",
    nameEn: "Drag curl",
    primary: ["biceps"],
  },

  // ───────── ТРИЦЕПС (доп.) ─────────
  {
    slug: "rope-pushdown",
    nameRu: "Разгибания с канатом на блоке",
    nameEn: "Rope pushdown",
    primary: ["triceps"],
  },
  {
    slug: "overhead-cable-extension",
    nameRu: "Разгибания над головой на блоке",
    nameEn: "Overhead cable extension",
    primary: ["triceps"],
  },
  {
    slug: "dumbbell-overhead-extension",
    nameRu: "Разгибания с гантелью над головой",
    nameEn: "Dumbbell overhead extension",
    primary: ["triceps"],
  },
  {
    slug: "jm-press",
    nameRu: "JM-жим",
    nameEn: "JM press",
    primary: ["triceps"],
    secondary: ["chest"],
  },
  {
    slug: "bench-dips",
    nameRu: "Обратные отжимания от скамьи",
    nameEn: "Bench dips",
    primary: ["triceps"],
    secondary: ["shoulders_front"],
    isBodyweight: true,
  },
  {
    slug: "machine-tricep-extension",
    nameRu: "Разгибания на трицепс в тренажёре",
    nameEn: "Machine triceps extension",
    primary: ["triceps"],
  },

  // ───────── ПРЕДПЛЕЧЬЯ И ХВАТ (доп.) ─────────
  {
    slug: "hand-gripper",
    nameRu: "Сжатие кистевого эспандера",
    nameEn: "Hand gripper squeeze",
    description:
      "Сжатие пружинного кистевого эспандера. Удобно логировать суммарным числом за день (тотал).",
    primary: ["forearms"],
  },
  {
    slug: "wrist-roller",
    nameRu: "Скручивание кистевого ролика",
    nameEn: "Wrist roller",
    primary: ["forearms"],
  },
  {
    slug: "plate-pinch",
    nameRu: "Удержание блинов щипковым хватом",
    nameEn: "Plate pinch hold",
    primary: ["forearms"],
  },
  {
    slug: "dead-hang",
    nameRu: "Вис на перекладине",
    nameEn: "Dead hang",
    primary: ["forearms"],
    secondary: ["back_lats"],
    isBodyweight: true,
  },
  {
    slug: "behind-back-wrist-curl",
    nameRu: "Сгибания запястий за спиной",
    nameEn: "Behind-the-back wrist curl",
    primary: ["forearms"],
  },
  {
    slug: "towel-pull-up",
    nameRu: "Подтягивания на полотенце",
    nameEn: "Towel pull-up",
    primary: ["forearms", "back_lats"],
    secondary: ["biceps"],
    isBodyweight: true,
  },
  {
    slug: "fat-grip-hold",
    nameRu: "Удержание толстого грифа",
    nameEn: "Fat grip hold",
    primary: ["forearms"],
  },
  {
    slug: "finger-curl",
    nameRu: "Сгибания пальцами (штанга)",
    nameEn: "Finger curl",
    primary: ["forearms"],
  },

  // ───────── КВАДРИЦЕПС (доп.) ─────────
  {
    slug: "hack-squat",
    nameRu: "Гакк-приседания",
    nameEn: "Hack squat",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "smith-squat",
    nameRu: "Приседания в Смите",
    nameEn: "Smith machine squat",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "pause-squat",
    nameRu: "Приседания с паузой",
    nameEn: "Pause squat",
    primary: ["quads", "glutes"],
    secondary: ["core"],
  },
  {
    slug: "box-squat",
    nameRu: "Приседания в ящик",
    nameEn: "Box squat",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "sissy-squat",
    nameRu: "Сисси-приседания",
    nameEn: "Sissy squat",
    primary: ["quads"],
    isBodyweight: true,
  },
  {
    slug: "lunge-reverse",
    nameRu: "Обратные выпады",
    nameEn: "Reverse lunge",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "lunge-dumbbell",
    nameRu: "Выпады с гантелями",
    nameEn: "Dumbbell lunge",
    primary: ["quads", "glutes"],
    secondary: ["hamstrings"],
  },
  {
    slug: "wall-sit",
    nameRu: "Присед у стены (стульчик)",
    nameEn: "Wall sit",
    primary: ["quads"],
    isBodyweight: true,
  },
  {
    slug: "pistol-squat",
    nameRu: "Приседания «пистолетик»",
    nameEn: "Pistol squat",
    primary: ["quads", "glutes"],
    secondary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "belt-squat",
    nameRu: "Приседания с поясом",
    nameEn: "Belt squat",
    primary: ["quads", "glutes"],
  },
  {
    slug: "zercher-squat",
    nameRu: "Приседания Зерхера",
    nameEn: "Zercher squat",
    primary: ["quads", "glutes"],
    secondary: ["core"],
  },

  // ───────── БИЦЕПС БЕДРА / ЯГОДИЦЫ (доп.) ─────────
  {
    slug: "nordic-curl",
    nameRu: "Нордические сгибания",
    nameEn: "Nordic hamstring curl",
    primary: ["hamstrings"],
    isBodyweight: true,
  },
  {
    slug: "single-leg-rdl",
    nameRu: "Румынская тяга на одной ноге",
    nameEn: "Single-leg Romanian deadlift",
    primary: ["hamstrings", "glutes"],
    secondary: ["core"],
  },
  {
    slug: "cable-pull-through",
    nameRu: "Протяжка на блоке между ног",
    nameEn: "Cable pull-through",
    primary: ["glutes", "hamstrings"],
  },
  {
    slug: "kettlebell-deadlift",
    nameRu: "Становая с гирей",
    nameEn: "Kettlebell deadlift",
    primary: ["glutes", "hamstrings"],
    secondary: ["back_lats"],
  },
  {
    slug: "single-leg-hip-thrust",
    nameRu: "Ягодичный мост на одной ноге",
    nameEn: "Single-leg hip thrust",
    primary: ["glutes"],
    secondary: ["hamstrings"],
    isBodyweight: true,
  },
  {
    slug: "frog-pump",
    nameRu: "Ягодичный мост «лягушка»",
    nameEn: "Frog pump",
    primary: ["glutes"],
  },
  {
    slug: "hip-abduction-machine",
    nameRu: "Отведение бёдер в тренажёре",
    nameEn: "Hip abduction machine",
    primary: ["glutes"],
  },
  {
    slug: "cable-hip-abduction",
    nameRu: "Отведение ноги в сторону на блоке",
    nameEn: "Cable hip abduction",
    primary: ["glutes"],
  },
  {
    slug: "curtsy-lunge",
    nameRu: "Реверанс-выпад",
    nameEn: "Curtsy lunge",
    primary: ["glutes", "quads"],
    secondary: ["hamstrings"],
  },
  {
    slug: "sumo-squat",
    nameRu: "Сумо-приседания (плие)",
    nameEn: "Sumo squat",
    primary: ["glutes", "quads"],
    secondary: ["hamstrings"],
  },

  // ───────── ИКРЫ (доп.) ─────────
  {
    slug: "leg-press-calf-raise",
    nameRu: "Жим носками в тренажёре для ног",
    nameEn: "Leg press calf raise",
    primary: ["calves"],
  },
  {
    slug: "single-leg-calf-raise",
    nameRu: "Подъём на носок одной ноги",
    nameEn: "Single-leg calf raise",
    primary: ["calves"],
    isBodyweight: true,
  },
  {
    slug: "jump-rope",
    nameRu: "Скакалка",
    nameEn: "Jump rope",
    primary: ["calves"],
    secondary: ["core"],
    isBodyweight: true,
  },

  // ───────── КОР (доп.) ─────────
  {
    slug: "crunch",
    nameRu: "Скручивания",
    nameEn: "Crunch",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "sit-up",
    nameRu: "Подъём туловища (сит-ап)",
    nameEn: "Sit-up",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "lying-leg-raise",
    nameRu: "Подъём ног лёжа",
    nameEn: "Lying leg raise",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "reverse-crunch",
    nameRu: "Обратные скручивания",
    nameEn: "Reverse crunch",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "bicycle-crunch",
    nameRu: "Скручивания «велосипед»",
    nameEn: "Bicycle crunch",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "mountain-climber",
    nameRu: "Скалолаз",
    nameEn: "Mountain climber",
    primary: ["core"],
    secondary: ["shoulders_front"],
    isBodyweight: true,
  },
  {
    slug: "v-up",
    nameRu: "Складка (V-up)",
    nameEn: "V-up",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "toes-to-bar",
    nameRu: "Носки к перекладине",
    nameEn: "Toes to bar",
    primary: ["core"],
    secondary: ["back_lats"],
    isBodyweight: true,
  },
  {
    slug: "hanging-knee-raise",
    nameRu: "Подъём коленей в висе",
    nameEn: "Hanging knee raise",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "pallof-press",
    nameRu: "Жим Паллоффа (антиротация)",
    nameEn: "Pallof press",
    primary: ["core"],
  },
  {
    slug: "hollow-hold",
    nameRu: "Удержание «лодочка»",
    nameEn: "Hollow body hold",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "dragon-flag",
    nameRu: "Флаг дракона",
    nameEn: "Dragon flag",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "windshield-wiper",
    nameRu: "«Дворники»",
    nameEn: "Windshield wiper",
    primary: ["core"],
    isBodyweight: true,
  },
  {
    slug: "cable-woodchopper",
    nameRu: "Дровосек на блоке",
    nameEn: "Cable woodchopper",
    primary: ["core"],
  },

  // ───────── ФУНКЦИОНАЛ / КОНДИЦИЯ ─────────
  {
    slug: "burpee",
    nameRu: "Бёрпи",
    nameEn: "Burpee",
    primary: ["quads", "chest", "core"],
    secondary: ["shoulders_front"],
    isBodyweight: true,
  },
  {
    slug: "box-jump",
    nameRu: "Запрыгивания на тумбу",
    nameEn: "Box jump",
    primary: ["quads", "glutes"],
    secondary: ["calves"],
    isBodyweight: true,
  },
  {
    slug: "battle-ropes",
    nameRu: "Канаты (battle ropes)",
    nameEn: "Battle ropes",
    primary: ["shoulders_front", "core"],
    secondary: ["forearms"],
  },
  {
    slug: "sled-push",
    nameRu: "Толкание саней",
    nameEn: "Sled push",
    primary: ["quads", "glutes"],
    secondary: ["calves", "core"],
  },
  {
    slug: "sled-pull",
    nameRu: "Тяга саней",
    nameEn: "Sled pull",
    primary: ["back_lats", "hamstrings"],
    secondary: ["biceps"],
  },
  {
    slug: "thruster",
    nameRu: "Трастер (присед + жим)",
    nameEn: "Thruster",
    primary: ["quads", "glutes", "shoulders_front"],
    secondary: ["triceps", "core"],
  },
  {
    slug: "wall-ball",
    nameRu: "Броски мяча в стену",
    nameEn: "Wall ball",
    primary: ["quads", "shoulders_front"],
    secondary: ["glutes", "core"],
  },
  {
    slug: "turkish-get-up",
    nameRu: "Турецкий подъём",
    nameEn: "Turkish get-up",
    primary: ["core", "shoulders_side"],
    secondary: ["glutes"],
  },
  {
    slug: "medicine-ball-slam",
    nameRu: "Удары мячом об пол",
    nameEn: "Medicine ball slam",
    primary: ["core", "back_lats"],
    secondary: ["shoulders_front"],
  },
];
