#!/usr/bin/env bash
#
# restore-drill.sh — H10.2 «бэкап без restore-репетиции = надежда, не бэкап».
#
# Восстанавливает ПОСЛЕДНИЙ дамп (~/backups/fitness-YYYY-MM-DD.sql.gz, формат
# exec33: plain `pg_dump $DATABASE_URL | gzip`, без --create) в одноразовую
# scratch-БД на ТОМ ЖЕ Postgres, сверяет COUNT(*) ключевых таблиц со снимком
# прода и ВСЕГДА дропает scratch (trap EXIT). Exit 0 = counts совпали.
#
# ── SUPERUSER ТОЛЬКО ДЛЯ ИЗОЛИРОВАННОЙ ПОДГОТОВКИ ───────────────────────────
# Скрипт создаёт scratch-БД и extension через postgres, но сам SQL из дампа
# исполняется временной NOSUPERUSER/NOCREATEDB/NOCREATEROLE ролью через TCP.
# Это не позволяет отравленному dump использовать COPY PROGRAM или менять prod.
#
#     sudo -u postgres bash /opt/fitness-saas/scripts/restore-drill.sh [DUMP.gz]
#
# Прод не меняется: читаем прод (fitness_saas) только SELECT COUNT(*); пишем лишь
# в отдельную fitness_restore_check, которая всегда дропается. Запускать вручную
# (НЕ в cron).
#
# Дамп лежит в домашней папке app-юзера (~/backups у i48ptgvnis); postgres-юзер
# обычно НЕ имеет туда доступа на чтение. Если дефолтный путь не читается —
# выдайте postgres точечный ACL на файл/каталог; не делайте dump world-readable.
#
set -euo pipefail
umask 077

PROD_DB="${PROD_DB:-fitness_saas}"
SCRATCH_DB="fitness_restore_check"
RESTORE_ROLE="fitness_restore_$$"
BACKUP_DIR="${BACKUP_DIR:-/home/i48ptgvnis/backups}"
TABLES=(users workouts workout_sets exercise_notes)
TMP_DIR="$(mktemp -d)"
PGPASS_FILE="$TMP_DIR/pgpass"

fail() { echo "restore-drill: $1" >&2; exit 1; }

# Все привилегированные операции — через peer-auth от текущего OS-юзера.
# При запуске `sudo -u postgres …` это суперюзер postgres (createdb + extension).
command -v psql   >/dev/null 2>&1 || fail "psql not found in PATH"
command -v gunzip >/dev/null 2>&1 || fail "gunzip not found in PATH"
command -v gzip   >/dev/null 2>&1 || fail "gzip not found in PATH"
command -v openssl >/dev/null 2>&1 || fail "openssl not found in PATH"

# --- выбор дампа: аргумент $1, иначе последний в BACKUP_DIR -------------------
if [ "${1:-}" != "" ]; then
  LATEST="$1"
else
  LATEST="$(ls -1 "$BACKUP_DIR"/fitness-*.sql.gz 2>/dev/null | sort | tail -1 || true)"
fi
[ -n "${LATEST:-}" ] || fail "no backup found (pass DUMP path as arg, or set BACKUP_DIR; run /api/cron/backup-db first)"
[ -r "$LATEST" ] || fail "dump not readable by $(id -un): $LATEST — grant a narrow ACL; never make it world-readable"
[ ! -L "$LATEST" ] || fail "refusing symlink backup: $LATEST"
gzip -t "$LATEST" || fail "backup gzip integrity check failed"
echo "restore-drill: latest dump = $LATEST"

# --- scratch дропается ВСЕГДА (даже при падении restore) ---------------------
cleanup() {
  rm -rf "$TMP_DIR"
  psql -d postgres -v ON_ERROR_STOP=0 \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${SCRATCH_DB}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
  psql -d postgres -v ON_ERROR_STOP=0 \
    -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null 2>&1 || true
  psql -d postgres -v ON_ERROR_STOP=0 \
    -c "DROP ROLE IF EXISTS ${RESTORE_ROLE};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "restore-drill: (re)creating scratch DB ${SCRATCH_DB}"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP ROLE IF EXISTS ${RESTORE_ROLE};"
RESTORE_PASSWORD="$(openssl rand -hex 32)"
psql -d postgres -v ON_ERROR_STOP=1 -q \
  -c "CREATE ROLE ${RESTORE_ROLE} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${RESTORE_PASSWORD}';"
psql -d postgres -v ON_ERROR_STOP=1 -q \
  -c "CREATE DATABASE ${SCRATCH_DB} OWNER ${RESTORE_ROLE};"
psql -d "$SCRATCH_DB" -v ON_ERROR_STOP=1 -q \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
printf '127.0.0.1:5432:%s:%s:%s\n' "$SCRATCH_DB" "$RESTORE_ROLE" "$RESTORE_PASSWORD" >"$PGPASS_FILE"
chmod 600 "$PGPASS_FILE"
unset RESTORE_PASSWORD

echo "restore-drill: restoring dump into scratch…"
gunzip -c "$LATEST" | PGPASSFILE="$PGPASS_FILE" PGSSLMODE=disable \
  psql --no-psqlrc -h 127.0.0.1 -U "$RESTORE_ROLE" -d "$SCRATCH_DB" \
    -v ON_ERROR_STOP=1 -q >/dev/null

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
