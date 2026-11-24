import { beforeEach, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "@/db/schema";

const db = vi.hoisted(() => ({ insert: vi.fn(), select: vi.fn(), transaction: vi.fn() }));
vi.mock("@/db/client", () => ({ db }));

import { upsertSleepHours } from "./sleep.repo";
import { upsertNutritionProtein } from "./nutrition.repo";
import { getWellnessLoggedDays, saveMorningWellness } from "./wellness.repo";

const queries: { sql: string; params: unknown[] }[] = [];
const sqlDb = drizzle.mock({ schema, casing: "snake_case" });

beforeEach(() => {
  vi.resetAllMocks();
  db.transaction.mockImplementation((operation) => operation(db));
  queries.length = 0;
  // Compile the real Drizzle statement; only its external execution is replaced.
  db.insert.mockImplementation((table) => ({
    values: (input: never) => ({
      onConflictDoUpdate: (config: never) => {
        queries.push(sqlDb.insert(table).values(input).onConflictDoUpdate(config).toSQL());
        return Promise.resolve();
      },
    }),
  }));
});

it("patches only hours on a sleep conflict, preserving concurrent quality and notes", async () => {
  await upsertSleepHours("athlete", "2026-11-24", 7.5);
  const statement = queries[0];
  const update = statement.sql.split(" do update set ")[1];
  expect(update).toMatch(/^"hours" = \$\d+, "updated_at" = \$\d+$/);
  expect(statement.params).toContain("athlete");
  expect(statement.params).toContain("2026-11-24");
  expect(statement.params).toContain(7.5);
});

it("patches only protein on a nutrition conflict, preserving concurrent macros and notes", async () => {
  await upsertNutritionProtein("athlete", "2026-11-23", 130);
  const statement = queries[0];
  const update = statement.sql.split(" do update set ")[1];
  expect(update).toMatch(/^"protein_g" = \$\d+, "updated_at" = \$\d+$/);
  expect(statement.params).toContain("athlete");
  expect(statement.params).toContain("2026-11-23");
  expect(statement.params).toContain(130);
});

it("writes independently supplied fields to their respective calendar days", async () => {
  await saveMorningWellness("athlete", { date: "2026-11-24", proteinDate: "2026-11-23", proteinG: 130 });
  expect(queries).toHaveLength(1);
  expect(queries[0].sql).toContain('insert into "nutrition_entries"');
  expect(queries[0].params).toContain("2026-11-23");
  queries.length = 0;
  await saveMorningWellness("athlete", { date: "2026-11-24", proteinDate: "2026-11-23", hours: 7.5, proteinG: 130 });
  expect(queries).toHaveLength(2);
  expect(queries[0].params).toContain("2026-11-24");
  expect(queries[1].params).toContain("2026-11-23");
});

it("counts recorded protein rather than empty nutrition entries and excludes future days", async () => {
  db.select.mockImplementation((fields) => ({
    from: (table: Parameters<typeof sqlDb.select>[0]) => ({
      where: (condition: never) => {
        const statement = sqlDb.select(fields).from(table as never).where(condition).toSQL();
        queries.push(statement);
        return Promise.resolve([{ days: statement.sql.includes('"sleep_logs"') ? 7 : 2 }]);
      },
    }),
  }));
  expect(await getWellnessLoggedDays("athlete", "2026-11-24")).toEqual({ sleepDays: 7, proteinDays: 2 });
  expect(queries[1].sql).toContain('"nutrition_entries"."protein_g" is not null');
  for (const statement of queries) {
    expect(statement.sql).toContain('"date" <=');
    expect(statement.params).toEqual(["athlete", "2026-11-24"]);
  }
});
