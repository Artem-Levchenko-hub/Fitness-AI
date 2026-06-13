import { describe, expect, it } from "vitest";

import { MUSCLE_KEYS, type MuscleKey } from "../domain/avatar/heat";

import fixture from "./muscle-mesh-names.fixture.json";
import { resolveMuscleKey } from "./muscle-mesh-map";

// H11.5 — аудит покрытия классификации мышц на РЕАЛЬНЫХ именах мешей
// public/models/muscles.glb (фикстура снимается scripts/dump-avatar-mesh-names.mjs).
// Цель не косметика меша, а ИНВАРИАНТ heat→prompt-пути: ни одна из 14 живых
// групп не должна молча выпасть в null/misroute — иначе аватар (столп 2) не
// подсветит зону, на которую тренер ссылается «X 0 подходов» (столп 1).
//
// Текущая модель собрана именованным пайплайном (build-avatar-from-named.mjs):
// меши группы слиты и названы ПРЯМО ключом группы → identity-резолв. Любой
// будущий переэкспорт с латинскими/новыми именами заставит эти ассерты
// заговорить, если группа выпадет или появится неожиданный неклассифицируемый
// меш.

// Узлы, которые ОБЯЗАНЫ резолвиться в null — неконтрактильные/декоративные
// (оболочка тела). Не нагрузка → не подсвечиваются, не выбираются (MuscleModel
// пропускает null на тапе). Новый меш вне этого списка, ушедший в null, = тихое
// выпадение → тест падает осознанно.
const EXPECTED_NULL = new Set<string>(["decor"]);

const names: string[] = fixture.meshNodeNames;

describe("H11.5 покрытие классификации мешей muscles.glb (реальные имена)", () => {
  it("фикстура непуста и снята с прод-модели", () => {
    expect(names.length).toBeGreaterThan(0);
    expect(fixture.generatedFrom).toBe("public/models/muscles.glb");
  });

  // Таблица покрытия: ключ → меши, что в него резолвятся.
  const coverage = new Map<MuscleKey, string[]>();
  const unclassified: string[] = [];
  for (const name of names) {
    const key = resolveMuscleKey(name);
    if (key === null) unclassified.push(name);
    else coverage.set(key, [...(coverage.get(key) ?? []), name]);
  }

  it.each(MUSCLE_KEYS.map((k) => [k] as const))(
    "группа %s покрыта ≥1 мешем (не выпадает молча)",
    (key) => {
      expect(coverage.get(key) ?? []).not.toHaveLength(0);
    },
  );

  it("неклассифицированные меши = только известный allowlist (decor)", () => {
    // Любой НОВЫЙ null-меш (не decor) — тихое выпадение группы: падаем громко.
    const unexpected = unclassified.filter((n) => !EXPECTED_NULL.has(n));
    expect(unexpected).toEqual([]);
  });

  it("каждый allowlisted-меш реально присутствует и резолвится в null", () => {
    for (const n of EXPECTED_NULL) {
      expect(names).toContain(n);
      expect(resolveMuscleKey(n)).toBeNull();
    }
  });

  it("все 14 групп покрыты, ноль misroute (итоговый вердикт)", () => {
    expect(coverage.size).toBe(MUSCLE_KEYS.length);
    // Каждый меш либо в группе, либо в allowlist — ничего третьего.
    const classified = names.filter((n) => resolveMuscleKey(n) !== null).length;
    expect(classified + unclassified.length).toBe(names.length);
    expect(unclassified.every((n) => EXPECTED_NULL.has(n))).toBe(true);
  });
});
