import { describe, expect, it } from "vitest";

import { buildPgPassLine, parsePgDumpConnection } from "./postgres-credentials";

describe("backup postgres credentials", () => {
  it("removes credentials from command-line connection fields", () => {
    const connection = parsePgDumpConnection(
      "postgresql://fitness:p%40ss%3Aword@db.internal:5433/fitness_prod?sslmode=require",
    );
    expect(connection).toEqual({
      host: "db.internal",
      port: "5433",
      database: "fitness_prod",
      user: "fitness",
      password: "p@ss:word",
      sslMode: "require",
    });
    expect(buildPgPassLine(connection)).toBe(
      "db.internal:5433:fitness_prod:fitness:p@ss\\:word",
    );
  });

  it.each([
    "https://user:password@example.com/db",
    "postgresql://user@example.com/db",
    "postgresql://:password@example.com/db",
    "postgresql://user:password@example.com/",
    "postgresql://user:password@example.com/db?sslmode=custom",
  ])("rejects an unsafe or incomplete DATABASE_URL: %s", (value) => {
    expect(() => parsePgDumpConnection(value)).toThrow(TypeError);
  });
});
