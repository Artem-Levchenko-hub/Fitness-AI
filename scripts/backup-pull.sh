#!/usr/bin/env bash
#
# backup-pull.sh — H10.5 off-site копия прод-бэкапа + dead-man свежести.
#
# Бэкапы H10.1 (~/backups/fitness-YYYY-MM-DD.sql.gz на prod-VPS, формат
# `pg_dump $DATABASE_URL | gzip`) лежат на ТОМ ЖЕ диске, что и БД. Смерть
# сервера = смерть данных И бэкапов, а история тренировок владельца —
# единственный невосстановимый актив продукта. Этот скрипт стягивает
# свежайший дамп с прода на машину владельца (off-site) и fail-loud,
# если cron-бэкап на сервере тихо умер (свежайший дамп старше 26 ч).
#
# Запуск — ВРУЧНУЮ с машины владельца (НЕ на проде, НЕ в cron — периодический
# pull это следующая волна, YAGNI до доказанного первого pull):
#
#     bash scripts/backup-pull.sh
#
# ── Windows ──────────────────────────────────────────────────────────────────
# Запускать с НАТИВНЫМ OpenSSH в PATH: bundled-ssh из Git Bash калечит
# кириллический $HOME (`Артём` → мусор) и не находит ключ. Прол:
#     PATH="/c/Windows/System32/OpenSSH:$PATH" bash scripts/backup-pull.sh
# либо из WSL со своим ~/.ssh/config. Native ssh/scp читают конфиг корректно.
#
# Параметры (env-override):
#   REMOTE             ssh-alias прода         (default kanavto-vps)
#   REMOTE_DIR         папка бэкапов на проде  (default backups → ~/backups)
#   LOCAL_BACKUP_DIR   локальная off-site папка (default $HOME/fitness-backups)
#   KEEP               сколько копий хранить    (default 4)
#   MAX_AGE_HOURS      dead-man порог свежести  (default 26)
#
# Тест-хук: BACKUP_PULL_TEST_MTIME=<epoch> подменяет mtime свежайшего дампа
# для синтетической проверки dead-man (см. гейт H10.5).
#
set -euo pipefail

REMOTE="${REMOTE:-kanavto-vps}"
REMOTE_DIR="${REMOTE_DIR:-backups}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$HOME/fitness-backups}"
KEEP="${KEEP:-4}"
MAX_AGE_HOURS="${MAX_AGE_HOURS:-26}"
PATTERN="fitness-*.sql.gz"

fail() { echo "backup-pull: $1" >&2; exit 1; }

command -v ssh  >/dev/null 2>&1 || fail "ssh not found in PATH"
command -v scp  >/dev/null 2>&1 || fail "scp not found in PATH"
command -v gzip >/dev/null 2>&1 || fail "gzip not found in PATH"

# --- свежайший дамп на сервере (по mtime), одной ssh-командой -----------------
# stat -c '%n|%Y|%s' = путь|epoch-mtime|размер; GNU coreutils (Linux+Git Bash).
REMOTE_STAT="$(ssh -o BatchMode=yes "$REMOTE" \
  "f=\$(ls -1t ~/$REMOTE_DIR/$PATTERN 2>/dev/null | head -1); \
   [ -n \"\$f\" ] && stat -c '%n|%Y|%s' \"\$f\"" || true)"
[ -n "$REMOTE_STAT" ] || fail "no remote dump matching $PATTERN in $REMOTE:~/$REMOTE_DIR — cron-backup may be dead (run /api/cron/backup-db?)"

REMOTE_PATH="${REMOTE_STAT%%|*}"
_rest="${REMOTE_STAT#*|}"
REMOTE_MTIME="${_rest%%|*}"
REMOTE_SIZE="${_rest##*|}"
REMOTE_BASENAME="$(basename "$REMOTE_PATH")"

# --- pull (scp) --------------------------------------------------------------
mkdir -p "$LOCAL_BACKUP_DIR"
DEST="$LOCAL_BACKUP_DIR/$REMOTE_BASENAME"
echo "backup-pull: freshest remote dump = $REMOTE_BASENAME (${REMOTE_SIZE}B) → $DEST"
scp -o BatchMode=yes "$REMOTE:$REMOTE_PATH" "$DEST" || fail "scp failed for $REMOTE:$REMOTE_PATH"

# --- целостность off-site копии ----------------------------------------------
[ -s "$DEST" ] || fail "copied file is empty: $DEST"
gzip -t "$DEST" || fail "gzip integrity check FAILED: $DEST (corrupt transfer?)"
LOCAL_SIZE="$(stat -c %s "$DEST")"
echo "backup-pull: verified $DEST (${LOCAL_SIZE}B, gzip OK)"

# --- ротация: оставить KEEP свежайших ----------------------------------------
mapfile -t ALL < <(ls -1t "$LOCAL_BACKUP_DIR"/$PATTERN 2>/dev/null || true)
if [ "${#ALL[@]}" -gt "$KEEP" ]; then
  for old in "${ALL[@]:$KEEP}"; do
    echo "backup-pull: rotating out $old"
    rm -f "$old"
  done
fi
RETAINED="$(ls -1 "$LOCAL_BACKUP_DIR"/$PATTERN 2>/dev/null | wc -l | tr -d ' ')"
echo "backup-pull: $RETAINED local copies retained (keep=$KEEP)"

# --- dead-man: свежайший дамп не должен быть старше MAX_AGE_HOURS -------------
# Проверка ПОСЛЕ копирования: off-site копию сохраняем в любом случае (даже
# старую — это лучшее, что есть), но fail-loud алертим о тихой смерти cron-а.
EFFECTIVE_MTIME="${BACKUP_PULL_TEST_MTIME:-$REMOTE_MTIME}"
NOW="$(date +%s)"
AGE_HOURS=$(( (NOW - EFFECTIVE_MTIME) / 3600 ))
echo "backup-pull: freshest dump age = ${AGE_HOURS}h (threshold ${MAX_AGE_HOURS}h)"
if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
  fail "DEAD-MAN: freshest remote dump is ${AGE_HOURS}h old (> ${MAX_AGE_HOURS}h) — cron-backup may be dead; investigate before trusting backups"
fi

echo "backup-pull: DONE — off-site copy fresh and verified."
