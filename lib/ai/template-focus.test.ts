import { describe, expect, it } from "vitest";

import { shouldShowFocusHint } from "./template-focus";

/** H5.7: решение «показывать ли строку-совет прошлого разбора на экране старта
 *  тренировки по шаблону». Чистая функция — ядро dismiss-логики, переиспользуется
 *  в клиентском компоненте и здесь без jsdom/localStorage. */
describe("shouldShowFocusHint", () => {
  it("показывает свежий совет, который ещё не закрывали", () => {
    expect(shouldShowFocusHint("Жим: 85×5", "an-1", null)).toBe(true);
  });

  it("прячет, если нет текста совета (focus null)", () => {
    expect(shouldShowFocusHint(null, "an-1", null)).toBe(false);
  });

  it("прячет пустую строку совета", () => {
    expect(shouldShowFocusHint("", "an-1", null)).toBe(false);
    expect(shouldShowFocusHint("   ", "an-1", null)).toBe(false);
  });

  it("прячет, если нет id разбора", () => {
    expect(shouldShowFocusHint("Жим: 85×5", null, null)).toBe(false);
  });

  it("прячет уже закрытый этим юзером совет (id совпал с dismissed)", () => {
    expect(shouldShowFocusHint("Жим: 85×5", "an-1", "an-1")).toBe(false);
  });

  it("снова показывает, когда появился НОВЫЙ разбор (id отличается от dismissed)", () => {
    expect(shouldShowFocusHint("Тяга: 100×5", "an-2", "an-1")).toBe(true);
  });
});
