import { describe, expect, it } from "vitest";

import {
  ageFromBirthDate,
  ageFromBirthDateString,
  bmiCategory,
  calculateBmi,
  leanBodyMassKg,
  waistToHeightRatio,
} from "./bmi";

// Характеризационные тесты: фиксируют ТЕКУЩИЙ контракт BMI-хелперов.
// Эти функции питают body-страницу (`app/(app)/body/page.tsx`) и контекст
// AI-коуча (категория BMI, возраст, lean mass). Ключевые решения под защитой:
// WHO-пороги через `<` (не `<=`), вычитание года до дня рождения, guard-ветки
// (вес/рост ≤0, bodyFat ≥100 → null). Любой рефактор границ ловится здесь.

describe("calculateBmi", () => {
  it("типичный рост/вес → BMI ≈ 22.86", () => {
    expect(calculateBmi(70, 175)).toBeCloseTo(22.86, 2);
  });

  it("точный квадрат: 25 кг при 100 см → ровно 25", () => {
    // heightM = 1 → BMI = weight
    expect(calculateBmi(25, 100)).toBe(25);
  });

  it("вес ≤0 → null", () => {
    expect(calculateBmi(0, 175)).toBeNull();
    expect(calculateBmi(-5, 175)).toBeNull();
  });

  it("рост ≤0 → null (без деления на ноль)", () => {
    expect(calculateBmi(70, 0)).toBeNull();
    expect(calculateBmi(70, -10)).toBeNull();
  });

  it("оба ≤0 → null", () => {
    expect(calculateBmi(0, 0)).toBeNull();
  });
});

describe("bmiCategory › WHO-пороги через `<` (границы)", () => {
  it("ниже 18.5 → underweight", () => {
    expect(bmiCategory(17)).toBe("underweight");
    expect(bmiCategory(18.49)).toBe("underweight");
  });

  it("ровно 18.5 → normal (не underweight — порог строгий `<`)", () => {
    expect(bmiCategory(18.5)).toBe("normal");
  });

  it("в диапазоне нормы → normal", () => {
    expect(bmiCategory(22)).toBe("normal");
    expect(bmiCategory(24.99)).toBe("normal");
  });

  it("ровно 25 → overweight (порог строгий `<`)", () => {
    expect(bmiCategory(25)).toBe("overweight");
  });

  it("в диапазоне overweight → overweight", () => {
    expect(bmiCategory(27)).toBe("overweight");
    expect(bmiCategory(29.99)).toBe("overweight");
  });

  it("ровно 30 → obese (порог строгий `<`)", () => {
    expect(bmiCategory(30)).toBe("obese");
  });

  it("высокий → obese", () => {
    expect(bmiCategory(40)).toBe("obese");
  });
});

describe("ageFromBirthDate", () => {
  it("день рождения уже прошёл в этом году → полный возраст", () => {
    const birth = new Date(1990, 0, 15); // 15 янв 1990
    const now = new Date(2026, 5, 11); // 11 июн 2026
    expect(ageFromBirthDate(birth, now)).toBe(36);
  });

  it("сегодня день рождения → полный возраст (не вычитаем)", () => {
    const birth = new Date(1990, 5, 11);
    const now = new Date(2026, 5, 11);
    expect(ageFromBirthDate(birth, now)).toBe(36);
  });

  it("за день до дня рождения → возраст −1", () => {
    const birth = new Date(1990, 5, 11);
    const now = new Date(2026, 5, 10); // на день раньше
    expect(ageFromBirthDate(birth, now)).toBe(35);
  });

  it("месяц до дня рождения → возраст −1", () => {
    const birth = new Date(1990, 5, 11);
    const now = new Date(2026, 4, 11); // май, на месяц раньше
    expect(ageFromBirthDate(birth, now)).toBe(35);
  });

  it("рождён 29 февраля, текущая дата 28 фев → ещё не наступил → −1", () => {
    const birth = new Date(2000, 1, 29); // 29 фев 2000 (високосный)
    const now = new Date(2026, 1, 28); // 28 фев 2026
    expect(ageFromBirthDate(birth, now)).toBe(25);
  });
});

describe("ageFromBirthDateString", () => {
  const now = new Date(2026, 5, 11); // 11 июн 2026

  it("день рождения уже прошёл → полный возраст", () => {
    expect(ageFromBirthDateString("1990-01-15", now)).toBe(36);
  });

  it("сегодня день рождения → полный возраст", () => {
    expect(ageFromBirthDateString("1990-06-11", now)).toBe(36);
  });

  // Регрессия, которую давала старая грубая формула (year-only вычитание):
  // 2026 − 1990 = 36, хотя день рождения (31 дек) ещё не наступил → должно 35.
  it("день рождения в этом году ЕЩЁ НЕ наступил → возраст −1 (не грубое вычитание лет)", () => {
    expect(ageFromBirthDateString("1990-12-31", now)).toBe(35);
  });

  it("мусорная строка → null", () => {
    expect(ageFromBirthDateString("not-a-date", now)).toBeNull();
  });

  it("пустая строка → null", () => {
    expect(ageFromBirthDateString("", now)).toBeNull();
  });

  it("год < 1900 (сентинел/мусор) → null", () => {
    expect(ageFromBirthDateString("1899-06-11", now)).toBeNull();
  });

  it("только год, без месяца/дня → null", () => {
    expect(ageFromBirthDateString("1990", now)).toBeNull();
  });
});

describe("leanBodyMassKg", () => {
  it("100 кг при 20% жира → 80 кг", () => {
    expect(leanBodyMassKg(100, 20)).toBeCloseTo(80, 5);
  });

  it("0% жира → полный вес", () => {
    expect(leanBodyMassKg(90, 0)).toBe(90);
  });

  it("вес ≤0 → null", () => {
    expect(leanBodyMassKg(0, 20)).toBeNull();
  });

  it("bodyFat <0 → null", () => {
    expect(leanBodyMassKg(80, -1)).toBeNull();
  });

  it("bodyFat ≥100 → null (граница 100 включительно)", () => {
    expect(leanBodyMassKg(80, 100)).toBeNull();
  });
});

describe("waistToHeightRatio", () => {
  it("80/160 → 0.5 (порог риска)", () => {
    expect(waistToHeightRatio(80, 160)).toBeCloseTo(0.5, 5);
  });

  it("90/180 → 0.5", () => {
    expect(waistToHeightRatio(90, 180)).toBeCloseTo(0.5, 5);
  });

  it("талия ≤0 → null", () => {
    expect(waistToHeightRatio(0, 180)).toBeNull();
  });

  it("рост ≤0 → null", () => {
    expect(waistToHeightRatio(80, 0)).toBeNull();
  });
});
