import { describe, expect, it } from "vitest";

import { resolveLifeFactorHref } from "./life-factor-links";

describe("resolveLifeFactorHref", () => {
  it("включён + score есть → ссылка", () => {
    expect(resolveLifeFactorHref("/sleep", 72, true)).toBe("/sleep");
    expect(resolveLifeFactorHref("/nutrition", 55, true)).toBe("/nutrition");
  });

  it("score === 0 (валидная оценка) → ссылка, не статика", () => {
    expect(resolveLifeFactorHref("/sleep", 0, true)).toBe("/sleep");
  });

  it("score == null (фактор не учтён) → null (R-37, без битой ссылки)", () => {
    expect(resolveLifeFactorHref("/sleep", null, true)).toBeNull();
  });

  it("выключён (чужой/share-разбор) → null даже при score", () => {
    expect(resolveLifeFactorHref("/sleep", 72, false)).toBeNull();
  });

  it("enabled undefined (default off) → null", () => {
    expect(resolveLifeFactorHref("/sleep", 72, undefined)).toBeNull();
  });
});
