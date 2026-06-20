import { describe, expect, it } from "vitest";

import {
  extractPartialTrainer,
  FRAME_REASONING,
  FRAME_TEXT,
  splitTrainerStream,
  STREAM_FRAME,
} from "./trainer-stream-parse";

const T = (s: string) => STREAM_FRAME + FRAME_TEXT + s;
const R = (s: string) => STREAM_FRAME + FRAME_REASONING + s;

describe("extractPartialTrainer", () => {
  it("returns empty object when there is no JSON yet", () => {
    expect(extractPartialTrainer("")).toEqual({});
    expect(extractPartialTrainer("тренер думает…")).toEqual({});
  });

  it("reads the score as soon as it has streamed", () => {
    const raw = `{"overallScore": 85, "trainingQuality": {"score": 80, "comment": "Хорошая ра`;
    const p = extractPartialTrainer(raw);
    expect(p.overallScore).toBe(85);
    expect(p.qualityComment).toBe("Хорошая ра");
  });

  it("reads a partially-streamed recommendations array", () => {
    const raw = `{"overallScore": 70, "recommendations": ["Добавь вес 2.5 кг", "Спи больше`;
    const p = extractPartialTrainer(raw);
    expect(p.recommendations).toEqual(["Добавь вес 2.5 кг", "Спи больше"]);
  });

  it("drops a dangling key that has no value yet", () => {
    const raw = `{"overallScore": 90, "motivation":`;
    const p = extractPartialTrainer(raw);
    expect(p.overallScore).toBe(90);
    expect(p.motivation).toBeUndefined();
  });

  it("strips a ```json fence and leading reasoning before the object", () => {
    const raw = "Подумаю… вот разбор:\n```json\n{\"overallScore\": 60, \"motivation\": \"Ты молодец\"";
    const p = extractPartialTrainer(raw);
    expect(p.overallScore).toBe(60);
    expect(p.motivation).toBe("Ты молодец");
  });

  it("parses a complete object into all surfaced fields", () => {
    const raw = JSON.stringify({
      overallScore: 75,
      trainingQuality: { score: 78, comment: "Стабильно" },
      recommendations: ["A", "B"],
      nextSessionFocus: "Присед 3×8",
      motivation: "Вперёд",
      whatWorked: "Жим вырос",
    });
    expect(extractPartialTrainer(raw)).toEqual({
      overallScore: 75,
      qualityComment: "Стабильно",
      recommendations: ["A", "B"],
      nextSessionFocus: "Присед 3×8",
      motivation: "Вперёд",
      whatWorked: "Жим вырос",
    });
  });

  it("ignores wrong-typed fields without throwing", () => {
    const raw = `{"overallScore": "нет", "motivation": 5}`;
    const p = extractPartialTrainer(raw);
    expect(p.overallScore).toBeUndefined();
    expect(p.motivation).toBeUndefined();
  });
});

describe("splitTrainerStream", () => {
  it("treats an unframed stream as pure JSON (back-compat)", () => {
    const raw = `{"overallScore": 80}`;
    expect(splitTrainerStream(raw)).toEqual({ thinking: "", json: raw });
  });

  it("separates reasoning and text channels", () => {
    const acc = R("Смотрю подходы…") + T(`{"overallScore":`) + T(" 90}");
    expect(splitTrainerStream(acc)).toEqual({
      thinking: "Смотрю подходы…",
      json: `{"overallScore": 90}`,
    });
  });

  it("reassembles interleaved frames in arrival order", () => {
    const acc =
      R("думаю ") + T(`{"motiv`) + R("ещё думаю ") + T(`ation":"Молодец"}`);
    expect(splitTrainerStream(acc)).toEqual({
      thinking: "думаю ещё думаю ",
      json: `{"motivation":"Молодец"}`,
    });
  });

  it("feeds the JSON channel into extractPartialTrainer", () => {
    const acc = R("прикидываю оценку") + T(`{"overallScore": 72, "motivation": "Ок`);
    const { json } = splitTrainerStream(acc);
    expect(extractPartialTrainer(json).overallScore).toBe(72);
    expect(extractPartialTrainer(json).motivation).toBe("Ок");
  });

  it("ignores a trailing incomplete frame (sentinel with no channel yet)", () => {
    const acc = T(`{"overallScore": 50}`) + STREAM_FRAME;
    expect(splitTrainerStream(acc)).toEqual({
      thinking: "",
      json: `{"overallScore": 50}`,
    });
  });
});
