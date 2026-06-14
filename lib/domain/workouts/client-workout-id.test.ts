import { describe, expect, it } from "vitest";

import { parseClientWorkoutId } from "./client-workout-id";

describe("parseClientWorkoutId", () => {
  it("принимает well-formed UUID (как от crypto.randomUUID)", () => {
    const id = "9b1c2d3e-4f50-41a2-8c0d-1e2f3a4b5c6d";
    expect(parseClientWorkoutId(id)).toBe(id);
  });

  it("нормализует регистр к нижнему", () => {
    const id = "9B1C2D3E-4F50-41A2-8C0D-1E2F3A4B5C6D";
    expect(parseClientWorkoutId(id)).toBe(id.toLowerCase());
  });

  it("обрезает пробелы вокруг ключа", () => {
    const id = "9b1c2d3e-4f50-41a2-8c0d-1e2f3a4b5c6d";
    expect(parseClientWorkoutId(`  ${id}  `)).toBe(id);
  });

  it("пустая строка → null (онлайн-старт без клиентского ключа)", () => {
    expect(parseClientWorkoutId("")).toBeNull();
    expect(parseClientWorkoutId("   ")).toBeNull();
  });

  it("null / не строка → null (fail-soft R-10)", () => {
    expect(parseClientWorkoutId(null)).toBeNull();
    expect(
      parseClientWorkoutId(new File([], "x") as unknown as FormDataEntryValue),
    ).toBeNull();
  });

  it("мусор / неполный UUID → null, старт не падает", () => {
    expect(parseClientWorkoutId("not-a-uuid")).toBeNull();
    expect(parseClientWorkoutId("9b1c2d3e-4f50-41a2-8c0d")).toBeNull();
    expect(
      parseClientWorkoutId("zzzzzzzz-4f50-41a2-8c0d-1e2f3a4b5c6d"),
    ).toBeNull();
    expect(parseClientWorkoutId("9b1c2d3e4f5041a28c0d1e2f3a4b5c6d")).toBeNull();
  });
});
