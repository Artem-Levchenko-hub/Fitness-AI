#!/usr/bin/env node
/**
 * Cron-runner — pm2-managed процесс, который дергает наши cron-роуты по
 * расписанию. Заменяет systemd timers без необходимости sudo.
 *
 *  - process-ai-jobs: каждую минуту
 *  - ai-billing:      каждую минуту (stale single-flight recovery)
 *  - daily-trainer:   каждый час (роут сам решит, у кого локально 22:00)
 *  - weekly-trainer:  каждый час (роут сам решит, у кого локально Вс 20:00)
 *  - push-reminders:  каждый час
 *  - payments:        каждый час (reconcile пропущенных webhook)
 *  - subscriptions:   каждый час (due/retry решает сам роут)
 *  - backup-db:       каждый час (роут сам делает дамп раз в сутки + ротация)
 *
 * Запускается через ecosystem.config.cjs как отдельный pm2-app.
 * Читает CRON_SECRET и NEXT_PUBLIC_APP_URL из окружения процесса.
 */

// CRON_BASE_URL = явный override; иначе всегда localhost (cron-runner работает
// на том же боксе что и web — публичный URL не нужен и часто недоступен
// из-за DNS-конфигурации внутри хостинга).
const BASE =
  process.env.CRON_BASE_URL ||
  `http://localhost:${process.env.CRON_TARGET_PORT || "3001"}`;
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error("[cron-runner] CRON_SECRET not set — refusing to start");
  process.exit(1);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

async function hit(path) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(
        `[cron-runner] ${path} → HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
    } else {
      console.log(`[cron-runner] ${path} → OK ${body.slice(0, 120)}`);
    }
  } catch (err) {
    console.error(`[cron-runner] ${path} → ${err.message}`);
  }
}

function scheduleEveryMinute(path) {
  void hit(path);
  setInterval(() => void hit(path), MINUTE);
}

function scheduleEveryHour(path) {
  // Запускаем сразу + потом каждый час. Реальные cron нужны только если
  // нужна синхронизация на «ровно :00» — наши роуты идемпотентны.
  void hit(path);
  setInterval(() => void hit(path), HOUR);
}

console.log(`[cron-runner] started, base=${BASE}`);

// process-ai-jobs дергаем чаще всего — обрабатывает свежие aiJobs.
scheduleEveryMinute("/api/cron/process-ai-jobs");
scheduleEveryMinute("/api/cron/ai-billing-reconcile");

// Hourly:
scheduleEveryHour("/api/cron/daily-trainer");
scheduleEveryHour("/api/cron/weekly-trainer");
scheduleEveryHour("/api/cron/push-reminders");
scheduleEveryHour("/api/cron/payments-reconcile");
scheduleEveryHour("/api/cron/subscriptions");
// Дамп прод-БД: тикаем ежечасно, роут сам делает дамп раз в сутки + ротацию.
scheduleEveryHour("/api/cron/backup-db");

// Корректное завершение в pm2 (graceful shutdown).
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
