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
umask 077

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
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum not found in PATH"

# --- свежайший дамп на сервере (по mtime), одной ssh-командой -----------------
# stat + SHA-256 arrive through the authenticated SSH channel. The digest does
# not replace an immutable signed backup manifest, but prevents accepting a
# truncated or substituted SCP result.
REMOTE_STAT="$(ssh -o BatchMode=yes "$REMOTE" \
  "f=\$(ls -1t ~/$REMOTE_DIR/$PATTERN 2>/dev/null | head -1); \
   [ -n \"\$f\" ] && printf '%s|' \"\$f\" && \
   stat -c '%Y|%s' \"\$f\" | tr -d '\n' && printf '|' && \
   sha256sum \"\$f\" | awk '{print \$1}'" || true)"
[ -n "$REMOTE_STAT" ] || fail "no remote dump matching $PATTERN in $REMOTE:~/$REMOTE_DIR — cron-backup may be dead (run /api/cron/backup-db?)"

REMOTE_PATH="${REMOTE_STAT%%|*}"
_rest="${REMOTE_STAT#*|}"
REMOTE_MTIME="${_rest%%|*}"
_rest="${_rest#*|}"
REMOTE_SIZE="${_rest%%|*}"
REMOTE_SHA256="${_rest##*|}"
REMOTE_BASENAME="$(basename "$REMOTE_PATH")"
[[ "$REMOTE_BASENAME" =~ ^fitness-[0-9]{4}-[0-9]{2}-[0-9]{2}\.sql\.gz$ ]] || fail "unexpected remote backup name"
[[ "$REMOTE_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail "invalid remote SHA-256"

# --- pull (scp) --------------------------------------------------------------
mkdir -p -m 700 "$LOCAL_BACKUP_DIR"
chmod 700 "$LOCAL_BACKUP_DIR"
DEST="$LOCAL_BACKUP_DIR/$REMOTE_BASENAME"
PART="${DEST}.part.$$"
trap 'rm -f "$PART"' EXIT
echo "backup-pull: freshest remote dump = $REMOTE_BASENAME (${REMOTE_SIZE}B) → $DEST"
scp -o BatchMode=yes "$REMOTE:$REMOTE_PATH" "$PART" || fail "scp failed for $REMOTE:$REMOTE_PATH"
chmod 600 "$PART"

# --- целостность off-site копии ----------------------------------------------
[ -s "$PART" ] || fail "copied file is empty: $PART"
gzip -t "$PART" || fail "gzip integrity check FAILED: $PART (corrupt transfer?)"
LOCAL_SHA256="$(sha256sum "$PART" | awk '{print $1}')"
[ "$LOCAL_SHA256" = "$REMOTE_SHA256" ] || fail "SHA-256 mismatch after transfer"
mv -f "$PART" "$DEST"
chmod 600 "$DEST"
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
