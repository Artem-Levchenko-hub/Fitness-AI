/** Чистая (без зависимостей) логика ГЛОБАЛЬНОЙ полосы возобновления (H12.4) —
 *  отдельный модуль, чтобы юнит-тест не тянул server-actions из active-resumes. */

/** Урезанный resume для глобальной полосы: только навигация «Продолжить», без
 *  `cancel` — «Убрать» живёт в карточке самой сессии (под-слайс 1), а server
 *  action в проп клиентского компонента тащить незачем. Сериализуем (href+label)
 *  — безопасно гонять через server action. */
export type ResumeView = { href: string; label: string };

/** Полосы, видимые на ТЕКУЩЕМ маршруте. Скрываем РОВНО ту сессию, на чьей
 *  странице мы стоим (href === pathname) — иначе глобальная полоса дублировала бы
 *  саму открытую сессию. Точный предикат (не любой [id]): /workouts/<activeId>
 *  скрыт, а /workouts (список) и /workouts/<completedId> — показаны; при двух
 *  параллельных сессиях остаётся вторая (молча не теряем — столп 4). */
export function visibleResumes(
  resumes: ResumeView[],
  pathname: string,
): ResumeView[] {
  return resumes.filter((r) => r.href !== pathname);
}
