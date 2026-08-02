import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parseEnvValue } = require("../scripts/parse-env-value.cjs") as {
  parseEnvValue(value: string): string;
};

describe("parseEnvValue", () => {
  it("снимает парные двойные кавычки", () => {
    expect(
      parseEnvValue('"Fitness AI <noreply@mail.lead-generator.ru>"'),
    ).toBe("Fitness AI <noreply@mail.lead-generator.ru>");
  });

  it("снимает парные одинарные кавычки", () => {
    expect(parseEnvValue("'quoted value'")).toBe("quoted value");
  });

  it("оставляет обычные и незакрытые значения без изменений", () => {
    expect(parseEnvValue("plain-value")).toBe("plain-value");
    expect(parseEnvValue('"unfinished')).toBe('"unfinished');
  });
});
