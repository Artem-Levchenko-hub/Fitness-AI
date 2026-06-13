import { describe, expect, it } from "vitest";

import { toInsightCard } from "./insight-card";

describe("toInsightCard", () => {
  it("цитата = «Автор, «Название»» без страницы, когда page = null", () => {
    const card = toInsightCard({
      content: "Mechanical tension drives hypertrophy.",
      sourceTitle: "Science and Development of Muscle Hypertrophy",
      sourceAuthor: "Brad Schoenfeld",
      page: null,
    });
    expect(card.citation).toBe(
      "Brad Schoenfeld, «Science and Development of Muscle Hypertrophy»",
    );
    expect(card.citation).not.toContain("с.");
  });

  it("добавляет « · с. N» только когда страница присутствует", () => {
    const card = toInsightCard({
      content: "x",
      sourceTitle: "Book",
      sourceAuthor: "Author",
      page: 42,
    });
    expect(card.citation).toBe("Author, «Book» · с. 42");
  });

  it("без автора — цитата только из названия", () => {
    const card = toInsightCard({
      content: "x",
      sourceTitle: "Book",
      sourceAuthor: null,
      page: null,
    });
    expect(card.citation).toBe("«Book»");
  });

  it("сворачивает переносы строк и лишние пробелы книжного куска", () => {
    const card = toInsightCard({
      content: "  Protein\nsynthesis   peaks\n\nafter training.  ",
      sourceTitle: "Book",
      sourceAuthor: null,
      page: null,
    });
    expect(card.text).toBe("Protein synthesis peaks after training.");
  });

  it("чистый текст не изменяется", () => {
    const card = toInsightCard({
      content: "Clean fact.",
      sourceTitle: "Book",
      sourceAuthor: "A",
      page: null,
    });
    expect(card.text).toBe("Clean fact.");
  });
});
