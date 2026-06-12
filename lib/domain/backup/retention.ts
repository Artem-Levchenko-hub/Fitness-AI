/**
 * Политика ротации бэкапов прод-БД (H10.1). Чистый домен — без fs/db (R-7):
 * принимает список имён файлов + сегодняшнюю дату, решает, какие удалить.
 * Оркестрация (pg_dump, чтение/удаление файлов) — в cron-роуте.
 *
 * Правило: храним 7 последних суточных + 4 последних «недельных» (по
 * понедельникам) СТАРШЕ суточного окна — т.е. недельные точки добавляются
 * ПОВЕРХ суточных, а не пересекаются с ними (понедельник внутри последних 7
 * дней уже покрыт суточным правилом и не тратит недельный слот). Остальное — на
 * удаление.
 */

export const DAILY_KEEP = 7;
export const WEEKLY_KEEP = 4;

const BACKUP_NAME_RE = /^fitness-(\d{4}-\d{2}-\d{2})\.sql\.gz$/;

/** Имя дампа → ISO-дата `YYYY-MM-DD`, либо null если не наш формат. */
export function parseBackupName(name: string): string | null {
  const m = BACKUP_NAME_RE.exec(name);
  return m ? m[1] : null;
}

/** Понедельник ли указанная ISO-дата (UTC-полночь — даты без времени). */
function isMonday(dateIso: string): boolean {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay() === 1;
}

/**
 * Из всех имён в каталоге бэкапов вернуть те, что подлежат удалению по политике
 * 7 суточных + 4 недельных. `today` не используется для отсчёта (храним по
 * свежести самих файлов), но принимается для детерминизма и будущих политик.
 * Не-матчащие имена игнорируются (никогда не удаляем чужое).
 */
export function selectExpiredBackups(
  names: readonly string[],
  today: string,
): string[] {
  void today; // зарезервировано: храним по свежести файлов, не по «сейчас»
  const files = names
    .map((name) => ({ name, date: parseBackupName(name) }))
    .filter((f): f is { name: string; date: string } => f.date !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // свежие первыми

  const dailyKept = files.slice(0, DAILY_KEEP);
  const keep = new Set(dailyKept.map((f) => f.name));

  // Недельные — только понедельники СТАРШЕ самого старого суточного (поверх окна).
  const oldestDaily = dailyKept.at(-1)?.date ?? null;
  const weekly = files.filter(
    (f) => isMonday(f.date) && (oldestDaily === null || f.date < oldestDaily),
  );
  for (const f of weekly.slice(0, WEEKLY_KEEP)) keep.add(f.name);

  return files.filter((f) => !keep.has(f.name)).map((f) => f.name);
}
