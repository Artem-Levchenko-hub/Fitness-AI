import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, rename, stat, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createGzip } from "node:zlib";

import { selectExpiredBackups } from "@/lib/domain/backup/retention";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorize(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Серверная локальная дата `YYYY-MM-DD` (бэкапы — единая БД, не per-user). */
function serverToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(now); // → 2026-06-12
}

const BACKUP_DIR = join(homedir(), "backups");

/** Стримит `pg_dump | gzip` в `tmp`, атомарно переименовывает в `dest`. */
function dumpTo(dest: string, tmp: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pg_dump", [env.DATABASE_URL], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += String(c).slice(0, 500);
    });

    const gzip = createGzip();
    const out = createWriteStream(tmp);
    let failed = false;
    const fail = (err: Error) => {
      if (failed) return;
      failed = true;
      child.kill();
      reject(new Error(`${err.message}${stderr ? ` | pg_dump: ${stderr}` : ""}`));
    };

    child.on("error", fail); // pg_dump бинарь не найден и т.п.
    gzip.on("error", fail);
    out.on("error", fail);

    child.stdout.pipe(gzip).pipe(out);

    child.on("close", (code) => {
      if (failed) return;
      if (code !== 0) {
        fail(new Error(`pg_dump exit ${code}`));
        return;
      }
      // pg_dump завершился ок — дождаться слива gzip→файл.
    });

    out.on("finish", async () => {
      if (failed) return;
      try {
        await rename(tmp, dest); // частичный дамп никогда не выглядит готовым
        resolve();
      } catch (err) {
        fail(err as Error);
      }
    });
  });
}

/**
 * Ежечасный тик (через cron-runner). Раз в сутки делает gzip-дамп прод-БД в
 * `~/backups/fitness-YYYY-MM-DD.sql.gz`, ротирует по политике 7 суточных + 4
 * недельных. Идемпотентно: если дамп за сегодня уже есть — только ротация.
 * Fail-soft (R-10): ошибка дампа не валит cron-runner.
 */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = serverToday(new Date());
  const fileName = `fitness-${today}.sql.gz`;
  const dest = join(BACKUP_DIR, fileName);
  const tmp = `${dest}.part`;

  await mkdir(BACKUP_DIR, { recursive: true });

  let dumped = false;
  let bytes = 0;
  try {
    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 0) {
      bytes = existing.size; // уже есть за сегодня — не дублируем дамп
    } else {
      await dumpTo(dest, tmp);
      bytes = (await stat(dest)).size;
      dumped = true;
    }
  } catch (err) {
    await unlink(tmp).catch(() => {});
    console.error(`[backup-db] dump failed: ${(err as Error).message}`);
    return Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }

  // Ротация — отдельно от дампа: даже если дамп сегодня пропущен, чистим старое.
  const deleted: string[] = [];
  try {
    const names = await readdir(BACKUP_DIR);
    for (const name of selectExpiredBackups(names, today)) {
      await unlink(join(BACKUP_DIR, name)).catch(() => {});
      deleted.push(name);
    }
  } catch (err) {
    console.error(`[backup-db] rotation failed: ${(err as Error).message}`);
  }

  return Response.json({ ok: true, dumped, file: fileName, bytes, deleted });
}

export async function GET(req: Request) {
  return POST(req);
}
