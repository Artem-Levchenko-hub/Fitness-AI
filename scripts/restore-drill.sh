#!/usr/bin/env bash
#
# restore-drill.sh — H10.2 «бэкап без restore-репетиции = надежда, не бэкап».
#
# Восстанавливает ПОСЛЕДНИЙ дамп (~/backups/fitness-YYYY-MM-DD.sql.gz, формат
# exec33: plain `pg_dump $DATABASE_URL | gzip`, без --create) в одноразовую
# scratch-БД на ТОМ ЖЕ Postgres, сверяет COUNT(*) ключевых таблиц со снимком
# прода и ВСЕГДА дропает scratch (trap EXIT). Exit 0 = counts совпали.
#
# ── ТРЕБУЕТ SUPERUSER ───────────────────────────────────────────────────────
# Дамп содержит `CREATE EXTENSION vector` (pgvector) + vector-колонки, а pgvector
# НЕ trusted → его создание требует superuser. Плюс роль приложения `fitness` не
# имеет CREATEDB. Поэтому верный (и единственный рабочий) способ — запуск ОТ
# суперюзера postgres через peer-auth (без паролей/URL):
#
#     sudo -u postgres bash /opt/fitness-saas/scripts/restore-drill.sh [DUMP.gz]
#
# Прод не меняется: читаем прод (fitness_saas) только SELECT COUNT(*); пишем лишь
# в отдельную fitness_restore_check, которая всегда дропается. Запускать вручную
# (НЕ в cron).
#
# Дамп лежит в домашней папке app-юзера (~/backups у i48ptgvnis); postgres-юзер
# обычно НЕ имеет туда доступа на чтение. Если дефолтный путь не читается —
# скопируйте дамп в общедоступное место и передайте путём аргументом:
#     cp ~/backups/fitness-2026-06-12.sql.gz /tmp/ && \
#     sudo -u postgres bash scripts/restore-drill.sh /tmp/fitness-2026-06-12.sql.gz
#
set -euo pipefail

PROD_DB="${PROD_DB:-fitness_saas}"
SCRATCH_DB="fitness_restore_check"
BACKUP_DIR="${BACKUP_DIR:-/home/i48ptgvnis/backups}"
TABLES=(users workouts workout_sets exercise_notes)

fail() { echo "restore-drill: $1" >&2; exit 1; }

# Все привилегированные операции — через peer-auth от текущего OS-юзера.
# При запуске `sudo -u postgres …` это суперюзер postgres (createdb + extension).
command -v psql   >/dev/null 2>&1 || fail "psql not found in PATH"
command -v gunzip >/dev/null 2>&1 || fail "gunzip not found in PATH"

# --- выбор дампа: аргумент $1, иначе последний в BACKUP_DIR -------------------
if [ "${1:-}" != "" ]; then
  LATEST="$1"
else
  LATEST="$(ls -1 "$BACKUP_DIR"/fitness-*.sql.gz 2>/dev/null | sort | tail -1 || true)"
fi
[ -n "${LATEST:-}" ] || fail "no backup found (pass DUMP path as arg, or set BACKUP_DIR; run /api/cron/backup-db first)"
[ -r "$LATEST" ] || fail "dump not readable by $(id -un): $LATEST — copy it somewhere world-readable (e.g. /tmp) and pass that path"
echo "restore-drill: latest dump = $LATEST"

# --- scratch дропается ВСЕГДА (даже при падении restore) ---------------------
cleanup() {
  psql -d postgres -v ON_ERROR_STOP=0 \
    -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "restore-drill: (re)creating scratch DB ${SCRATCH_DB}"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${SCRATCH_DB};"

echo "restore-drill: restoring dump into scratch…"
gunzip -c "$LATEST" | psql -d "$SCRATCH_DB" -v ON_ERROR_STOP=1 -q >/dev/null

# --- сверка COUNT(*) prod vs scratch ----------------------------------------
echo "restore-drill: comparing row counts (prod vs restored)…"
mismatch=0
for t in "${TABLES[@]}"; do
  prod="$(psql -d "$PROD_DB" -tAc "SELECT COUNT(*) FROM \"$t\";")"
  scratch="$(psql -d "$SCRATCH_DB" -tAc "SELECT COUNT(*) FROM \"$t\";")"
  if [ "$prod" = "$scratch" ]; then
    printf '  OK   %-16s prod=%s scratch=%s\n' "$t" "$prod" "$scratch"
  else
    printf '  FAIL %-16s prod=%s scratch=%s\n' "$t" "$prod" "$scratch"
    mismatch=1
  fi
done

if [ "$mismatch" -eq 0 ]; then
  echo "restore-drill: PASS — all key-table counts match; backup is restorable."
else
  echo "restore-drill: FAIL — count mismatch (drift during dump, or corrupt backup)." >&2
fi
exit "$mismatch"
