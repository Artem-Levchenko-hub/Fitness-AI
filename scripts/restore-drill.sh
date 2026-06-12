#!/usr/bin/env bash
#
# restore-drill.sh — H10.2 «бэкап без restore-репетиции = надежда, не бэкап».
#
# Восстанавливает ПОСЛЕДНИЙ дамп (~/backups/fitness-YYYY-MM-DD.sql.gz, формат
# exec33: plain `pg_dump $DATABASE_URL | gzip`, без --create) в одноразовую
# scratch-БД на ТОМ ЖЕ Postgres, сверяет COUNT(*) ключевых таблиц со снимком
# прода и ВСЕГДА дропает scratch (trap EXIT). Exit 0 = counts совпали.
#
# Ничего на проде не меняет: читает прод только SELECT COUNT(*), пишет лишь в
# отдельную fitness_restore_check. Запускать вручную (НЕ в cron) на прод-боксе:
#   bash /opt/fitness-saas/scripts/restore-drill.sh
#
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/fitness-saas/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
SCRATCH_DB="fitness_restore_check"
TABLES=(users workouts workout_sets exercise_notes)

fail() { echo "restore-drill: $1" >&2; exit 1; }

# --- DATABASE_URL из .env.production (снимаем кавычки/возможный CR) ----------
[ -f "$ENV_FILE" ] || fail "env not found: $ENV_FILE"
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
DATABASE_URL="${DATABASE_URL%$'\r'}"
DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
[ -n "$DATABASE_URL" ] || fail "DATABASE_URL empty in $ENV_FILE"

# --- последний дамп ---------------------------------------------------------
LATEST="$(ls -1 "$BACKUP_DIR"/fitness-*.sql.gz 2>/dev/null | sort | tail -1)"
[ -n "$LATEST" ] || fail "no backup in $BACKUP_DIR (run /api/cron/backup-db first)"
echo "restore-drill: latest dump = $LATEST"

# --- ADMIN_URL (db→postgres) + SCRATCH_URL (db→scratch), сохранив ?query -----
url_noq="${DATABASE_URL%%\?*}"
qs=""
[ "$url_noq" != "$DATABASE_URL" ] && qs="?${DATABASE_URL#*\?}"
BASE="${url_noq%/*}"            # postgres://user:pass@host:port
ADMIN_URL="${BASE}/postgres${qs}"
SCRATCH_URL="${BASE}/${SCRATCH_DB}${qs}"

# --- scratch дропается ВСЕГДА (даже при падении restore) ---------------------
cleanup() {
  psql "$ADMIN_URL" -v ON_ERROR_STOP=0 \
    -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "restore-drill: (re)creating scratch DB ${SCRATCH_DB}"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE ${SCRATCH_DB};"

echo "restore-drill: restoring dump into scratch…"
gunzip -c "$LATEST" | psql "$SCRATCH_URL" -v ON_ERROR_STOP=1 -q >/dev/null

# --- сверка COUNT(*) prod vs scratch ----------------------------------------
echo "restore-drill: comparing row counts (prod vs restored)…"
mismatch=0
for t in "${TABLES[@]}"; do
  prod="$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM \"$t\";")"
  scratch="$(psql "$SCRATCH_URL" -tAc "SELECT COUNT(*) FROM \"$t\";")"
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
