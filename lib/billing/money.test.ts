import { describe, it, expect } from "vitest";
import {
  TOPUP_PACKAGES,
  MIN_TOPUP_RUB,
  MAX_TOPUP_RUB,
  rubToKopecks,
  kopecksToRub,
  formatRub,
} from "./money";

// Характеризационное покрытие денежного пути (рубли ↔ копейки).
// Фиксирует контракт арифметики/форматирования, на которую опираются
// checkout-роут (rubToKopecks, MIN/MAX) и billing-страница (formatRub).

describe("rubToKopecks", () => {
  it("целые рубли в копейки", () => {
    expect(rubToKopecks(330)).toBe(33000);
    expect(rubToKopecks(1)).toBe(100);
    expect(rubToKopecks(2000)).toBe(200000);
  });

  it("ноль остаётся нулём", () => {
    expect(rubToKopecks(0)).toBe(0);
  });

  it("дробные рубли округляются (Math.round)", () => {
    expect(rubToKopecks(0.5)).toBe(50);
    expect(rubToKopecks(10.99)).toBe(1099);
  });
});

describe("kopecksToRub", () => {
  it("копейки в рубли", () => {
    expect(kopecksToRub(33000)).toBe(330);
    expect(kopecksToRub(50)).toBe(0.5);
    expect(kopecksToRub(0)).toBe(0);
  });

  it("round-trip rub→kop→rub для целых значений", () => {
    for (const rub of [330, 660, 1290, 2580]) {
      expect(kopecksToRub(rubToKopecks(rub))).toBe(rub);
    }
  });
});

describe("formatRub", () => {
  it("целые рубли без дробной части и без разряда", () => {
    expect(formatRub(33000)).toBe("330 ₽");
    expect(formatRub(0)).toBe("0 ₽");
  });

  it("копейки рендерятся через запятую (ru-RU)", () => {
    expect(formatRub(1050)).toBe("10,5 ₽");
    expect(formatRub(199)).toBe("1,99 ₽");
  });

  it("разряды тысяч группируются, целое без дробной части (ICU-агностично)", () => {
    // ru-RU использует NBSP/narrow-NBSP как разделитель тысяч — нормализуем
    // любой whitespace, чтобы тест не зависел от версии ICU прод-рантайма.
    const normalized = formatRub(100000).replace(/\s/g, "");
    expect(normalized).toBe("1000₽");
    expect(formatRub(100000)).toContain("₽");
  });
});

describe("константы пополнения", () => {
  it("ровно 4 пакета с возрастающими суммами", () => {
    expect(TOPUP_PACKAGES).toHaveLength(4);
    expect(TOPUP_PACKAGES.map((p) => p.rub)).toEqual([
      330, 660, 1290, 2580,
    ]);
  });

  it("каждый пакет имеет rub/label/subtitle", () => {
    for (const pkg of TOPUP_PACKAGES) {
      expect(typeof pkg.rub).toBe("number");
      expect(pkg.label.length).toBeGreaterThan(0);
      expect(pkg.subtitle.length).toBeGreaterThan(0);
    }
  });

  it("границы пополнения", () => {
    expect(MIN_TOPUP_RUB).toBe(330);
    expect(MAX_TOPUP_RUB).toBe(50_000);
    expect(MIN_TOPUP_RUB).toBeLessThan(MAX_TOPUP_RUB);
  });
});
