/**
 * H16.1 — построение RAG-запроса для «книжных фактов под сессию» в момент
 * ожидания разбора. Карточки фактов (H16.2) тянут /api/ai/trainer/insights,
 * который кормит этот запрос в `retrieveRelevant` против английского корпуса
 * (на проде — Schoenfeld «Science and Development of Muscle Hypertrophy»).
 *
 * Почему EN-токены: корпус английский, эмбеддинг `text-embedding-3-small`.
 * Короткий RU-keyword-запрос рискует не пройти minSimilarity → карточки тихо
 * умрут. Ключи групп мышц уже английские (chest, quads…), у упражнений есть
 * nameEn — этого достаточно, плюс базовые тренировочные термины как якорь.
 *
 * Чистая (R-7): db/auth не импортит. Вход — мышцы/упражнения, НЕ workoutId:
 * source-agnostic, чтобы будущий «факт дня» на дашборде звал её напрямую с
 * произвольным набором мышц (см. план H16.1).
 */

export type InsightQueryInput = {
  /** Ключи групп мышц (muscle_group_key): chest, back_lats, quads… */
  muscleGroups: string[];
  /** Английские имена упражнений сессии (exercises.nameEn). */
  exerciseNamesEn: string[];
};

/** Якорь тренировочной темы (EN) — гарантирует, что даже пустая сессия даёт
 *  осмысленный запрос про гипертрофию, а не пустую строку. */
const BASE_TRAINING_TERMS =
  "hypertrophy muscle growth training volume rest periods";

/** «back_lats» → «back lats»: ключ-енам в естественный английский токен для
 *  эмбеддинга (подчёркивания разбивают слово и портят similarity). */
function normalizeMuscleKey(key: string): string {
  return key.replace(/_/g, " ").trim().toLowerCase();
}

/** Дедуп без учёта регистра, порядок первого вхождения сохраняется. */
function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = raw.trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

/**
 * Строит EN-запрос: мышцы (нормализованные) + имена упражнений + базовые
 * тренировочные термины, через пробел. Пустой вход → только базовые термины
 * (запрос никогда не пустой). Дубли групп/имён схлопываются.
 */
export function buildInsightQuery(input: InsightQueryInput): string {
  const muscles = dedupe(input.muscleGroups.map(normalizeMuscleKey));
  const exercises = dedupe(input.exerciseNamesEn);
  return [...muscles, ...exercises, BASE_TRAINING_TERMS].join(" ");
}

/** Сырая строка из join'а упражнение↔группа-мышц (одно упражнение даёт по
 *  строке на каждую primary/secondary группу). */
export type InsightInputRow = {
  nameEn: string;
  muscleGroupKey: string | null;
};

/**
 * Схлопывает join-строки в уникальные группы мышц + имена упражнений для
 * `buildInsightQuery`. Общий код для силового (loadWorkoutInsightInputs) и
 * кругового (loadCircuitInsightInputs) лоадеров — одно знание «как собрать
 * вход фактов из строк», в одном месте (DRY-знание). null-ключ групп
 * отбрасывается; порядок первого вхождения сохраняется.
 */
export function dedupInsightInputs(rows: InsightInputRow[]): InsightQueryInput {
  const muscleGroups = [
    ...new Set(
      rows
        .map((r) => r.muscleGroupKey)
        .filter((k): k is string => k != null),
    ),
  ];
  const exerciseNamesEn = [...new Set(rows.map((r) => r.nameEn))];
  return { muscleGroups, exerciseNamesEn };
}
