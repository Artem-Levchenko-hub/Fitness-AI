export const MYO_REPS_RESEARCH_ACTIVATION_REP_RANGE = "6-12RM";
export const MYO_REPS_RESEARCH_FIRST_REST_SECONDS = 40;
export const MYO_REPS_RESEARCH_MINI_REST_SECONDS = 20;

export const MYO_REPS_SOURCES = [
  {
    label: "Bradshaw et al., 2026 · RCT (PubMed)",
    url: "https://pubmed.ncbi.nlm.nih.gov/42112925/",
  },
  {
    label: "Jukic et al., 2021 · review/meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/33417154/",
  },
  {
    label: "Tsartsapakis et al., 2026 · systematic review/meta-analysis",
    url: "https://pubmed.ncbi.nlm.nih.gov/41718208/",
  },
] as const;

export const MYO_REPS_RESEARCH_NOTE =
  "Свежий RCT 2026 у тренированных мужчин показал сопоставимые изменения силы и мышечной массы с традиционными сетами при примерно на 30% меньшем volume load, но это не доказывает эквивалентность для каждого атлета и каждого упражнения.";

export const MYO_REPS_LIMITATION_NOTE =
  "Прямые данные пока ограничены: короткий срок, небольшая выборка, в основном верх тела и trained men. Поэтому Myo-reps — это опция экономии времени и вариативности, а не универсальное назначение.";

export const MYO_REPS_SAFETY_NOTE =
  "Не подменяет спортивную медицину: при боли, головокружении, сердечно-сосудистых ограничениях, проблемах с давлением или технично сложных упражнениях используй метод только с тренером или врачом и останавливайся до распада техники.";

export function formatMyoResearchProtocol(): string {
  return `Исследовательский ориентир: 1 активационный подход ${MYO_REPS_RESEARCH_ACTIVATION_REP_RANGE}, затем около ${MYO_REPS_RESEARCH_FIRST_REST_SECONDS}с до первого мини-подхода и около ${MYO_REPS_RESEARCH_MINI_REST_SECONDS}с между следующими мини-подходами; мини-подходы авторегулируются, а не назначаются как универсально одинаковые для всех.`;
}
