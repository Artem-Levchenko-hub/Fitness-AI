/** H16.2 — «книжный факт под сессию» для карточки в момент ожидания разбора.
 *  Чистая презентационная нормализация куска из RAG (R-7: ни db/auth, ни сети):
 *  сырой book-chunk (с переносами строк) → компактный текст + человекочитаемая
 *  цитата. Источник на проде один — Schoenfeld, гипертрофия (англоязычный
 *  корпус), поэтому text остаётся как есть в книге (EN), без LLM-перевода
 *  (YAGNI/стоимость — решение зафиксировано в H16.1). */

export type InsightChunk = {
  content: string;
  sourceTitle: string;
  sourceAuthor: string | null;
  /** Номер страницы у текущего прод-корпуса = null (ingest её не пишет) —
   *  тогда «с. N» опускаем, не выдумываем. */
  page: number | null;
};

export type InsightCard = {
  text: string;
  citation: string;
};

/** Сворачивает любые пробелы/переносы строк книжного куска в одинарные пробелы
 *  и обрезает края — карточка показывает связный абзац, а не сырой PDF-разрыв. */
function collapseWhitespace(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** Цитата: «Автор, "Название"» (+ « · с. N» только если страница реально есть). */
function formatCitation(chunk: InsightChunk): string {
  const base = chunk.sourceAuthor
    ? `${chunk.sourceAuthor}, «${chunk.sourceTitle}»`
    : `«${chunk.sourceTitle}»`;
  return chunk.page != null ? `${base} · с. ${chunk.page}` : base;
}

export function toInsightCard(chunk: InsightChunk): InsightCard {
  return {
    text: collapseWhitespace(chunk.content),
    citation: formatCitation(chunk),
  };
}
