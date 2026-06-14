import { describe, expect, it } from "vitest";

import { parseClientSetId } from "./client-set-id";

describe("parseClientSetId", () => {
  it("принимает well-formed UUID (как от crypto.randomUUID)", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(parseClientSetId(id)).toBe(id);
  });

  it("нормализует регистр к нижнему", () => {
    const id = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";
    expect(parseClientSetId(id)).toBe(id.toLowerCase());
  });

  it("обрезает пробелы вокруг ключа", () => {
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    expect(parseClientSetId(`  ${id}  `)).toBe(id);
  });

  it("пустая строка → null (онлайн legacy без идемпотентности)", () => {
    expect(parseClientSetId("")).toBeNull();
    expect(parseClientSetId("   ")).toBeNull();
  });

  it("null / не строка → null (fail-soft R-10)", () => {
    expect(parseClientSetId(null)).toBeNull();
    expect(parseClientSetId(new File([], "x") as unknown as FormDataEntryValue)).toBeNull();
  });

  it("мусор / неполный UUID → null, запись не падает", () => {
    expect(parseClientSetId("not-a-uuid")).toBeNull();
    expect(parseClientSetId("3f2504e0-4f89-41d3-9a0c")).toBeNull();
    expect(parseClientSetId("zzzzzzzz-4f89-41d3-9a0c-0305e82c3301")).toBeNull();
    expect(parseClientSetId("3f2504e04f8941d39a0c0305e82c3301")).toBeNull();
  });
});
