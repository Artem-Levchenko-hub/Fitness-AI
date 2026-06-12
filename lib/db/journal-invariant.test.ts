import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Регрессионный страж drizzle-ledger (H10.3).
 *
 * Прод-`pnpm db:migrate` решает «применять ли миграцию» по правилу
 * `migration.when > max(created_at в __drizzle_migrations)` — порог снимается
 * ОДИН раз до цикла (см. drizzle-orm PgDialect.migrate). Два инварианта поля
 * `when` держат это правило здоровым:
 *
 *  1. Строгая монотонность по idx — `when` растёт вместе с порядком применения,
 *     как и генерит сам drizzle-kit (`when = Date.now()`). Немонотонность
 *     ломает реконсиляцию ledger (порог одной миграции «перепрыгивает» соседей).
 *  2. Ни одного `when` в будущем — иначе порог уходит выше «сейчас», и
 *     СЛЕДУЮЩАЯ сгенерированная миграция (`when ≈ Date.now()`) окажется НИЖЕ
 *     порога и будет молча пропущена. Ровно эта ловушка (idx 8/9/11/12/13 были
 *     датированы 2026-06-15…20) блокировала H14-миграции до реконсиляции.
 */
describe("drizzle migration journal invariants", () => {
  const journal = JSON.parse(
    readFileSync(
      join(process.cwd(), "db/migrations/meta/_journal.json"),
      "utf8",
    ),
  ) as { entries: { idx: number; when: number; tag: string }[] };

  it("has at least one entry", () => {
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it("is strictly monotonic by `when` in idx order", () => {
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1];
      const cur = journal.entries[i];
      expect(
        cur.when,
        `entry ${cur.tag} (when=${cur.when}) must be > previous ${prev.tag} (when=${prev.when})`,
      ).toBeGreaterThan(prev.when);
    }
  });

  it("has no future-dated `when` (would silently skip the next generated migration)", () => {
    const now = Date.now();
    for (const e of journal.entries) {
      expect(
        e.when,
        `entry ${e.tag} (when=${e.when}) is future-dated relative to now=${now}`,
      ).toBeLessThanOrEqual(now);
    }
  });
});
