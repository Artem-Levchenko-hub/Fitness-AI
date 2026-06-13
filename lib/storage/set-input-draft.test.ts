import { describe, expect, it } from "vitest";

import {
  isEmptySetDraft,
  parseSetDraft,
  serializeSetDraft,
  setDraftKey,
  type SetInputDraft,
} from "@/lib/storage/set-input-draft";

describe("setDraftKey", () => {
  it("неймспейсит ключ по workoutExerciseId", () => {
    expect(setDraftKey("we-123")).toBe("fit:set-draft:we-123");
  });
});

describe("parseSetDraft", () => {
  it("null/пустая строка → null", () => {
    expect(parseSetDraft(null)).toBeNull();
    expect(parseSetDraft("")).toBeNull();
  });

  it("битый JSON → null (fail-soft R-10)", () => {
    expect(parseSetDraft("{не json")).toBeNull();
  });

  it("валидный черновик → объект", () => {
    const raw = serializeSetDraft({ weight: "80", reps: "8", rpe: "9" });
    expect(parseSetDraft(raw)).toEqual({ weight: "80", reps: "8", rpe: "9" });
  });

  it("все поля пустые → null (нечего восстанавливать)", () => {
    const raw = serializeSetDraft({ weight: "", reps: "", rpe: "" });
    expect(parseSetDraft(raw)).toBeNull();
  });

  it("нестроковые поля коэрсятся в '' ; если всё пусто → null", () => {
    expect(parseSetDraft(JSON.stringify({ w: 80, r: null, e: undefined }))).toBeNull();
  });

  it("частично заполненный черновик восстанавливается", () => {
    const raw = serializeSetDraft({ weight: "100", reps: "", rpe: "" });
    expect(parseSetDraft(raw)).toEqual({ weight: "100", reps: "", rpe: "" });
  });
});

describe("serializeSetDraft round-trip", () => {
  it("сериализация → парс возвращает исходное", () => {
    const draft: SetInputDraft = { weight: "62.5", reps: "12", rpe: "" };
    expect(parseSetDraft(serializeSetDraft(draft))).toEqual(draft);
  });
});

describe("isEmptySetDraft", () => {
  it("все пустые → true", () => {
    expect(isEmptySetDraft({ weight: "", reps: "", rpe: "" })).toBe(true);
  });

  it("любое заполнено → false", () => {
    expect(isEmptySetDraft({ weight: "", reps: "5", rpe: "" })).toBe(false);
    expect(isEmptySetDraft({ weight: "80", reps: "", rpe: "" })).toBe(false);
  });
});
