import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import {
  buildPgPassLine,
  parsePgDumpConnection,
} from "@/lib/domain/backup/postgres-credentials";
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
async function dumpTo(dest: string, tmp: string): Promise<void> {
  const connection = parsePgDumpConnection(env.DATABASE_URL);
  const credentialDir = await mkdtemp(join(BACKUP_DIR, ".pgpass-"));
  await chmod(credentialDir, 0o700);
  const passFile = join(credentialDir, "pgpass");
  await writeFile(passFile, `${buildPgPassLine(connection)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await chmod(passFile, 0o600);

  const safeParentEnv = { ...process.env };
  delete safeParentEnv.DATABASE_URL;
  const child = spawn("pg_dump", ["--no-owner", "--no-privileges"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...safeParentEnv,
      PGHOST: connection.host,
      PGPORT: connection.port,
      PGDATABASE: connection.database,
      PGUSER: connection.user,
      PGPASSFILE: passFile,
      ...(connection.sslMode ? { PGSSLMODE: connection.sslMode } : {}),
    },
  });

  try {
    let stderr = "";
    child.stderr.on("data", (c) => {
      stderr += String(c).slice(0, 500);
    });

    const exited = new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`pg_dump exit ${code}${stderr ? `: ${stderr}` : ""}`));
      });
    });
    const out = createWriteStream(tmp, { flags: "wx", mode: 0o600 });
    await Promise.all([
      pipeline(child.stdout, createGzip(), out),
      exited,
    ]);
    await rename(tmp, dest); // частичный дамп никогда не выглядит готовым
    await chmod(dest, 0o600);
  } catch (error) {
    child.kill();
    throw error;
  } finally {
    await rm(credentialDir, { recursive: true, force: true }).catch(() => {});
  }
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

  await mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  await chmod(BACKUP_DIR, 0o700);

  let dumped = false;
  let bytes = 0;
  try {
    const existing = await stat(dest).catch(() => null);
    if (existing && existing.size > 0) {
      await chmod(dest, 0o600);
      bytes = existing.size; // уже есть за сегодня — не дублируем дамп
    } else {
      await unlink(tmp).catch(() => {});
      await dumpTo(dest, tmp);
      bytes = (await stat(dest)).size;
      dumped = true;
    }
  } catch (err) {
    await unlink(tmp).catch(() => {});
    console.error(`[backup-db] dump failed: ${(err as Error).message}`);
    return Response.json(
      { ok: false, error: "backup_failed" },
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
