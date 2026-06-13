import { describe, expect, it } from "vitest";
import { QueryBuilder } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { buildTrainerMemoryFilter } from "./trainer-memory-filter";

/** Рендерит фильтр в SQL без подключения к БД (standalone QueryBuilder).
 *  Значения enum параметризуются (`kind = $1`) → проверяем и sql, и params. */
function render(kind: Parameters<typeof buildTrainerMemoryFilter>[0]) {
  const { sql, params } = new QueryBuilder()
    .select()
    .from(schema.aiAnalyses)
    .where(buildTrainerMemoryFilter(kind))
    .toSQL();
  return { sql: sql.toLowerCase(), params };
}

describe("buildTrainerMemoryFilter", () => {
  it("daily_digest исключает weekly_review через коррелированный NOT EXISTS", () => {
    const { sql, params } = render("daily_digest");
    // Ключевая защита 2-го под-слайса: дайджест-память не тащит недельные строки.
    expect(sql).toContain("not exists");
    expect(sql).toContain("ai_jobs");
    expect(sql).toContain("kind");
    expect(params).toContain("weekly_review");
    // и при этом по-прежнему требует оба null (digest = workout/circuit оба пусты)
    expect(sql).toContain("workout_id");
    expect(sql).toContain("circuit_workout_id");
  });

  it("daily_digest коррелирует подзапрос по analysis_id (а не глобально)", () => {
    const { sql } = render("daily_digest");
    expect(sql).toContain("analysis_id");
  });

  it("circuit_post_workout НЕ затрагивает weekly_review (фильтр по circuit_workout_id)", () => {
    const { sql, params } = render("circuit_post_workout");
    expect(params).not.toContain("weekly_review");
    expect(sql).not.toContain("not exists");
    expect(sql).toContain("circuit_workout_id");
  });

  it("strength (post_workout/on_demand) НЕ затрагивает weekly_review", () => {
    for (const kind of ["post_workout", "on_demand"] as const) {
      const { sql, params } = render(kind);
      expect(params, kind).not.toContain("weekly_review");
      expect(sql, kind).not.toContain("not exists");
      expect(sql, kind).toContain("workout_id");
    }
  });
});
