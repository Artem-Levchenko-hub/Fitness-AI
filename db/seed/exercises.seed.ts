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
  },
  {
    slug: "chin-up",
    nameRu: "Подтягивания обратным хватом",
    nameEn: "Chin-up",
    primary: ["back_lats", "biceps"],
    secondary: ["back_traps"],
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
];
