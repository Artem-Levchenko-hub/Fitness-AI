import { describe, it, expect } from "vitest";

import { chunkText } from "./chunker";

/**
 * Характеризационное покрытие `chunkText` — семантического чанкера book-RAG.
 *
 * Что РЕАЛЬНО потребляется ниже по стеку: `chunk.content` пишется в
 * `knowledge_chunks.content` (`scripts/ingest-book.ts`) → эмбеддится →
 * `retrieve.ts` достаёт `content` для AI-контекста тренера. Регресс в
 * разбиении на абзацы / overlap / minSize = испорченный retrieval = хуже
 * советы AI. Эти тесты фиксируют контракт КОНТЕНТА.
 *
 * Про offsets: `charStart/charEnd` пишутся в `knowledge_chunks.metadata`, но
 * `retrieve.ts` читает назад только `metadata.page`/`section` — char-offsets
 * НИКОГДА не читаются. Для overlap-чанков формула offset'а к тому же
 * сворачивается в старый `bufStart` (контент overlap-чанка = НЕсмежная
 * склейка tail+абзац, для которой смежный offset в принципе ill-defined) →
 * это дремлющий, не-читаемый баг. НЕ фиксим (нет потребителя, scope-creep);
 * характеризуем текущее значение, чтобы будущий рефактор это заметил.
 */
describe("chunkText", () => {
  it("короткий одиночный абзац → ровно 1 чанк, контент сохранён", () => {
    const chunks = chunkText("Hello world.", { minSize: 5 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Hello world.");
    // одиночный чанк: bufStart=0 → offsets КОРРЕКТНЫ
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe(12);
  });

  it("два мелких абзаца в пределах targetSize → склейка в 1 чанк через \\n\\n", () => {
    const chunks = chunkText("Para one.\n\nPara two.", {
      targetSize: 50,
      minSize: 5,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Para one.\n\nPara two.");
    expect(chunks[0].charEnd).toBe(20);
  });

  it("превышение targetSize → split, второй чанк начинается с overlap-хвоста первого", () => {
    const text = "AAAAAAAAAA\n\nBBBBBBBBBB\n\nCCCCCCCCCC";
    const chunks = chunkText(text, {
      targetSize: 30,
      overlap: 10,
      minSize: 5,
    });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toBe("AAAAAAAAAA\n\nBBBBBBBBBB");
    // overlap: хвост первого чанка переносится в начало второго
    expect(chunks[0].content.endsWith("BBBBBBBBBB")).toBe(true);
    expect(chunks[1].content).toBe("BBBBBBBBBB\n\nCCCCCCCCCC");
    expect(chunks[1].content.startsWith("BBBBBBBBBB")).toBe(true);
    // первый чанк: offsets КОРРЕКТНЫ
    expect(chunks[0].charStart).toBe(0);
    expect(chunks[0].charEnd).toBe(21 + 1); // 22
  });

  it("overlap-чанк: charStart = ИЗВЕСТНОЕ дремлющее значение (0), не читается назад", () => {
    const chunks = chunkText("AAAAAAAAAA\n\nBBBBBBBBBB\n\nCCCCCCCCCC", {
      targetSize: 30,
      overlap: 10,
      minSize: 5,
    });
    // формула строки 52-55 сворачивается в старый bufStart=0 (должно быть 12).
    // НЕ читается retrieve.ts → дремлющий баг, зафиксирован как характеристика.
    expect(chunks[1].charStart).toBe(0);
  });

  it("хвостовой буфер ниже minSize отбрасывается", () => {
    const chunks = chunkText("AAAAAAAAAA\n\nBBBBBBBBBB\n\nCCCCCCCCCC", {
      targetSize: 30,
      overlap: 10,
      minSize: 100,
    });
    // первый чанк (22) запушен в цикле; финальный буфер (22) < 100 → drop
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("AAAAAAAAAA\n\nBBBBBBBBBB");
  });

  it("overlap отрезается по границе слова (частичное ведущее слово отбрасывается)", () => {
    const chunks = chunkText("XXXXXXXXXX YYYYYYYYYY\n\nZZZZZZZZZZ", {
      targetSize: 30,
      overlap: 12,
      minSize: 5,
    });
    expect(chunks).toHaveLength(2);
    // lastNChars(21-симв, 12) = "X YYYYYYYYYY"; пробел на idx 1 → отрезает "X "
    expect(chunks[1].content.startsWith("YYYYYYYYYY")).toBe(true);
    expect(chunks[1].content.includes("X")).toBe(false);
  });

  it("нормализация: \\r\\n → \\n, контент без возвратов каретки", () => {
    const chunks = chunkText("Line1\r\n\r\nLine2", {
      targetSize: 50,
      minSize: 5,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Line1\n\nLine2");
    expect(chunks[0].content.includes("\r")).toBe(false);
  });

  it("нормализация: 3+ перевода строки сворачиваются в \\n\\n (граница абзаца)", () => {
    const chunks = chunkText("A\n\n\n\nB", { targetSize: 50, minSize: 1 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("A\n\nB");
  });

  it("абзацы триммятся по краям", () => {
    const chunks = chunkText(" Para with spaces \n\nNext ", {
      targetSize: 50,
      minSize: 5,
    });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Para with spaces\n\nNext");
  });

  it("пустая строка → []", () => {
    expect(chunkText("", { minSize: 5 })).toEqual([]);
  });

  it("только пробелы/табы/пустые абзацы → []", () => {
    expect(chunkText("   \n\n  \t ", { minSize: 5 })).toEqual([]);
  });
});
