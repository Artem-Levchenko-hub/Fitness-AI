import { MUSCLE_KEYS, type MuscleKey } from "../domain/avatar/heat";

/** Резолвер имени меша из glb → наша группа мышц (одна из 14) или null.
 *
 *  «Шов модели»: реальная анатомическая модель (Z-Anatomy Myology и др.) даёт
 *  сотни мешей с латинскими именами (Pectoralis_major.L, Biceps_femoris…). Их
 *  надо свести к нашим 14 группам. Резолвер работает по токенам (имя → набор
 *  слов) и упорядоченным правилам «специфичное → общее», поэтому корректно
 *  различает омонимы: biceps brachii → biceps, но biceps femoris → hamstrings;
 *  triceps brachii → triceps, но triceps surae → calves.
 *
 *  Также понимает модель, чьи меши названы прямо нашими ключами (placeholder
 *  или специально подготовленный glb) — см. identity-проверку.
 *
 *  Чистый модуль (нет three/db) — юнит-тестируется на реалистичных именах. */

type Rule = { tokens: string[]; key: MuscleKey };

// Порядок ВАЖЕН: специфичные многословные правила раньше общих, иначе
// «biceps» перехватит «biceps femoris». Первое подходящее правило выигрывает.
const RULES: Rule[] = [
  // Квадрицепс
  { tokens: ["rectus", "femoris"], key: "quads" },
  { tokens: ["vastus"], key: "quads" },
  { tokens: ["quadriceps"], key: "quads" },
  // Бицепс бедра / задняя поверхность
  { tokens: ["biceps", "femoris"], key: "hamstrings" },
  { tokens: ["semitendinosus"], key: "hamstrings" },
  { tokens: ["semimembranosus"], key: "hamstrings" },
  { tokens: ["hamstring"], key: "hamstrings" },
  // Икры (triceps surae — раньше общего triceps)
  { tokens: ["triceps", "surae"], key: "calves" },
  { tokens: ["gastrocnemius"], key: "calves" },
  { tokens: ["soleus"], key: "calves" },
  { tokens: ["calf"], key: "calves" },
  { tokens: ["calves"], key: "calves" },
  // Руки (brachii — раньше общих biceps/triceps)
  { tokens: ["biceps", "brachii"], key: "biceps" },
  { tokens: ["triceps", "brachii"], key: "triceps" },
  // Предплечья
  { tokens: ["brachioradialis"], key: "forearms" },
  { tokens: ["flexor"], key: "forearms" },
  { tokens: ["extensor"], key: "forearms" },
  { tokens: ["pronator"], key: "forearms" },
  { tokens: ["supinator"], key: "forearms" },
  { tokens: ["anconeus"], key: "forearms" },
  { tokens: ["forearm"], key: "forearms" },
  // Спина
  { tokens: ["latissimus"], key: "back_lats" },
  { tokens: ["lats"], key: "back_lats" },
  { tokens: ["trapezius"], key: "back_traps" },
  { tokens: ["rhomboid"], key: "back_traps" },
  { tokens: ["trap"], key: "back_traps" },
  // Дельты (front/rear раньше общего deltoid → shoulders_side)
  { tokens: ["anterior", "deltoid"], key: "shoulders_front" },
  { tokens: ["front", "deltoid"], key: "shoulders_front" },
  { tokens: ["posterior", "deltoid"], key: "shoulders_rear" },
  { tokens: ["rear", "deltoid"], key: "shoulders_rear" },
  { tokens: ["lateral", "deltoid"], key: "shoulders_side" },
  { tokens: ["medial", "deltoid"], key: "shoulders_side" },
  { tokens: ["side", "deltoid"], key: "shoulders_side" },
  { tokens: ["deltoid"], key: "shoulders_side" },
  { tokens: ["delt"], key: "shoulders_side" },
  // Грудь
  { tokens: ["pectoralis"], key: "chest" },
  { tokens: ["pectoral"], key: "chest" },
  { tokens: ["pec"], key: "chest" },
  // Кор
  { tokens: ["abdominis"], key: "core" },
  { tokens: ["abdominal"], key: "core" },
  { tokens: ["oblique"], key: "core" },
  { tokens: ["abs"], key: "core" },
  { tokens: ["core"], key: "core" },
  // Ягодицы
  { tokens: ["gluteus"], key: "glutes" },
  { tokens: ["gluteal"], key: "glutes" },
  { tokens: ["glute"], key: "glutes" },
  // Общие (после разрешения омонимов выше)
  { tokens: ["biceps"], key: "biceps" },
  { tokens: ["triceps"], key: "triceps" },
  { tokens: ["quad"], key: "quads" },
];

const KEY_SET = new Set<string>(MUSCLE_KEYS);

/** Разбить имя на токены: lowercase, разделители → пробел, выкинуть сторону
 *  (l/r/left/right) и чистые числа. */
function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t && !/^\d+$/.test(t) && !["l", "r", "left", "right"].includes(t));
}

export function resolveMuscleKey(meshName: string): MuscleKey | null {
  if (!meshName) return null;

  const tokens = tokenize(meshName);
  if (tokens.length === 0) return null;

  // Identity: меш назван ПРЯМО ключом (chest, back_lats) — точное совпадение
  // очищенного имени, НЕ подстрока. Иначе «biceps_femoris» поймался бы на
  // ключ «biceps» вместо правила hamstrings.
  const cleaned = tokens.join("_");
  if (KEY_SET.has(cleaned)) return cleaned as MuscleKey;

  const tokenSet = new Set(tokens);
  for (const rule of RULES) {
    if (rule.tokens.every((t) => tokenSet.has(t))) return rule.key;
  }
  return null;
}

export { KEY_SET };
