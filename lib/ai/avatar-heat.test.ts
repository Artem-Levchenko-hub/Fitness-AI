import { describe, expect, it } from "vitest";

import { formatAvatarHeatBlock } from "./avatar-heat";

/** Хелпер: 14 групп с нулями, переопределяем нужные. */
function rows(overrides: Record<string, number>) {
  const base = [
    "chest",
    "back_lats",
    "back_traps",
    "shoulders_front",
    "shoulders_side",
    "shoulders_rear",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "glutes",
    "quads",
    "hamstrings",
    "calves",
  ];
  return base.map((muscleKey) => ({
    muscleKey,
    weeklySets: overrides[muscleKey] ?? 0,
  }));
}

describe("formatAvatarHeatBlock", () => {
  it("называет самую нагруженную и перечисляет недогруженные группы", () => {
    const block = formatAvatarHeatBlock(
      rows({ chest: 16, triceps: 8, quads: 0, hamstrings: 0 }),
    );
    expect(block).toContain("# Аватар: недельная нагрузка по группам мышц");
    // Самая горячая — грудь (16 сетов).
    expect(block).toMatch(/Самая нагруженная:\s*Грудь/);
    // Недогруженные (0 сетов) перечислены поимённо — тренер должен их назвать.
    expect(block).toContain("Квадрицепс");
    expect(block).toContain("Бицепс бедра");
    // Реальное число у груди.
    expect(block).toContain("16");
  });

  it("при нулевой неделе даёт плейсхолдер, без 'самой нагруженной'", () => {
    const block = formatAvatarHeatBlock(rows({}));
    expect(block).toContain("# Аватар: недельная нагрузка по группам мышц");
    expect(block).toMatch(/не зафиксировано рабочих подходов/);
    expect(block).not.toContain("Самая нагруженная:");
  });

  it("при равенстве максимума берёт первую по каноническому порядку групп", () => {
    // chest и back_lats обе по 10 — chest идёт раньше в MUSCLE_KEYS.
    const block = formatAvatarHeatBlock(rows({ chest: 10, back_lats: 10 }));
    expect(block).toMatch(/Самая нагруженная:\s*Грудь/);
  });

  it("дробные сеты (secondary 0.5) показывает с одним знаком", () => {
    const block = formatAvatarHeatBlock(rows({ chest: 12.5 }));
    expect(block).toContain("12.5");
  });

  it("единственная тренированная группа — она же самая нагруженная, остальные холодные", () => {
    const block = formatAvatarHeatBlock(rows({ biceps: 6 }));
    expect(block).toMatch(/Самая нагруженная:\s*Бицепс/);
    // 13 групп с нулём → перечислены как недогруженные.
    expect(block).toContain("Грудь");
    expect(block).toContain("Икры");
  });
});
