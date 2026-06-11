import { describe, it, expect } from "vitest";

import { slugify } from "./slugify";

/** Характеризационное покрытие транслит-примитива slug'ов. `slugify` строит
 *  URL-safe идентификатор кастомного упражнения (exercises.repo.ts — slug +
 *  uuid-суффикс). Имена упражнений владельца КИРИЛЛИЧЕСКИЕ ("Жим лёжа") →
 *  регресс RU_MAP/regex/порядка trim·slice = сломанная идентичность упражнения.
 *  Источник аудирован — баг НЕ найден; это фиксация контракта, не багфикс. */
describe("slugify — кириллица", () => {
  it("реальное имя владельца: «Жим лёжа» → zhim-lyozha (ё→yo, пробел→дефис)", () => {
    expect(slugify("Жим лёжа")).toBe("zhim-lyozha");
  });

  it("«Приседания» → prisedaniya", () => {
    expect(slugify("Приседания")).toBe("prisedaniya");
  });

  it("щ → sch (3-символьная транслитерация): «Щука» → schuka", () => {
    expect(slugify("Щука")).toBe("schuka");
  });

  it("твёрдый/мягкий знаки выпадают: «подъём» → podyom (ъ→'', ё→yo)", () => {
    expect(slugify("подъём")).toBe("podyom");
  });

  it("заглавная кириллица сначала lower-case: «ЖИМ» → zhim", () => {
    expect(slugify("ЖИМ")).toBe("zhim");
  });

  it("строка только из ъ/ь → пустой slug", () => {
    expect(slugify("ъь")).toBe("");
  });
});

describe("slugify — ASCII и смешанное", () => {
  it("ASCII проходит насквозь: «Bench Press» → bench-press", () => {
    expect(slugify("Bench Press")).toBe("bench-press");
  });

  it("кириллица + латиница: «Bulgarian сплит» → bulgarian-split", () => {
    expect(slugify("Bulgarian сплит")).toBe("bulgarian-split");
  });

  it("цифры сохраняются: «Жим 100кг» → zhim-100kg", () => {
    expect(slugify("Жим 100кг")).toBe("zhim-100kg");
  });
});

describe("slugify — нормализация разделителей", () => {
  it("серия не-буквенно-цифровых сворачивается в ОДИН дефис: «Жим — гантели!» → zhim-ganteli", () => {
    expect(slugify("Жим — гантели!")).toBe("zhim-ganteli");
  });

  it("ведущие/замыкающие пробелы обрезаются: «  присед  » → prised", () => {
    expect(slugify("  присед  ")).toBe("prised");
  });

  it("пустая строка → пустой slug", () => {
    expect(slugify("")).toBe("");
  });

  it("только пунктуация → пустой slug", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("slugify — длина и порядок trim·slice", () => {
  it("результат всегда ≤ 80 символов", () => {
    const long = "Жим".repeat(50); // 50×«zhim» = 200 символов до среза
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });

  it("КВИРК: slice(0,80) выполняется ПОСЛЕ обрезки дефисов → срез может ВЕРНУТЬ замыкающий дефис", () => {
    const input = "a".repeat(79) + " b"; // → "a"×79 + "-b", срез по 80 = "a"×79 + "-"
    const result = slugify(input);
    expect(result).toHaveLength(80);
    expect(result).toBe("a".repeat(79) + "-");
  });
});
