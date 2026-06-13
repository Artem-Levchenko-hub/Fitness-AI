/** H11.4 (под-слайс 2) — блок «# Флаги» для контекста per-workout разбора:
 *  тренер ПРЕДУПРЕЖДАЕТ, а не только разбирает (столп 1). Чистый модуль —
 *  нет импортов db/ai/env (R-07): данные приходят готовыми (застой считается
 *  reuse-ом detectStagnation, перегруз — из heat-профиля), формат-логика
 *  юнит-тестируема без сети. Зеркало avatar-heat.ts. */

/** Застойное упражнение сегодняшней сессии: имя + длина застоя в сессиях
 *  (streak из detectStagnation — то же число, что показывает бейдж на
 *  /exercises/[id]). */
export type StagnantFlag = {
  nameRu: string;
  streak: number;
};

/** Перегруженная группа мышц: подпись + недельные подходы (>15 = перегруз). */
export type OverloadedFlag = {
  label: string;
  weeklySets: number;
};

/** Паукальная форма «сессия/сессии/сессий» для счётной конструкции (1 сессия,
 *  3 сессии, 5 сессий) — та же грамматика, что у бейджа застоя. */
function pluralSessions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сессия";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сессии";
  return "сессий";
}

/** Подходы в человекочитаемое число: дробные (secondary даёт 0.5) — с одним
 *  знаком, целые — без хвоста. */
function fmtSets(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Блок «# Флаги» для промпта тренера. Глубокий модуль (R-01): «есть ли что
 *  показать» решает сама функция. Возвращает `null`, когда флагов нет —
 *  тогда вызывающий НЕ добавляет пустой заголовок (R-37: ноль фантомных
 *  состояний; тренер не выдумывает застой на пустом блоке). */
export function formatFlagsBlock(input: {
  stagnant: StagnantFlag[];
  overloaded: OverloadedFlag[];
}): string | null {
  const { stagnant, overloaded } = input;
  if (stagnant.length === 0 && overloaded.length === 0) return null;

  const lines: string[] = [
    "# Флаги (приоритет — адресовать каждый в рекомендациях)",
  ];

  for (const s of stagnant) {
    lines.push(
      `- «${s.nameRu}»: e1RM не растёт ${s.streak} ${pluralSessions(s.streak)} подряд — застой.`,
    );
  }

  for (const o of overloaded) {
    lines.push(
      `- ${o.label}: ${fmtSets(o.weeklySets)} подходов за неделю — перегруз (15+).`,
    );
  }

  return lines.join("\n");
}
