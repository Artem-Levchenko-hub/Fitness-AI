export type Resume = { href: string; label: string };

/** Единая сборка resume-баннеров активных сессий (силовая / круговая / кардио)
 *  для дашборда, /workouts и глобальной полосы — одна правда о подписях, чтобы
 *  тексты не разъезжались между экранами. Только навигация «Продолжить»:
 *  отмена («Убрать») живёт в карточке самой сессии (H12.4 под-слайс 1), а не в
 *  resume-баннере — поэтому модуль без зависимостей (server-actions не тащим). */
export function buildResumes(opts: {
  activeId: string | null;
  activeCircuitId: string | null;
  activeCardioId: string | null;
}): Resume[] {
  const { activeId, activeCircuitId, activeCardioId } = opts;

  const entries: (Resume | null)[] = [
    activeId
      ? { href: `/workouts/${activeId}`, label: "Активная тренировка" }
      : null,
    activeCircuitId
      ? { href: `/circuits/${activeCircuitId}`, label: "Активная круговая" }
      : null,
    activeCardioId
      ? { href: `/cardio/${activeCardioId}`, label: "Активная кардио-сессия" }
      : null,
  ];

  return entries.filter((r): r is Resume => r !== null);
}
