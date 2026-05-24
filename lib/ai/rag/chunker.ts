export type Chunk = {
  content: string;
  charStart: number;
  charEnd: number;
};

type ChunkOpts = {
  targetSize?: number;
  overlap?: number;
  minSize?: number;
};

/** Семантический chunker — режет по абзацам, склеивает до target_size,
 *  добавляет overlap из последнего абзаца предыдущего чанка.
 *  Сохраняет char offsets для page-mapping в metadata. */
export function chunkText(text: string, opts: ChunkOpts = {}): Chunk[] {
  const targetSize = opts.targetSize ?? 1000;
  const overlap = opts.overlap ?? 200;
  const minSize = opts.minSize ?? 100;

  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  const paragraphs = splitParagraphs(normalized);

  const chunks: Chunk[] = [];
  let buf = "";
  let bufStart = 0;
  let cursor = 0;

  for (const p of paragraphs) {
    const pStart = normalized.indexOf(p, cursor);
    cursor = pStart + p.length;

    if (buf.length === 0) {
      buf = p;
      bufStart = pStart;
      continue;
    }

    if (buf.length + 2 + p.length <= targetSize) {
      buf = buf + "\n\n" + p;
      continue;
    }

    chunks.push({
      content: buf,
      charStart: bufStart,
      charEnd: bufStart + buf.length,
    });

    const tail = lastNChars(buf, overlap);
    buf = tail.length > 0 ? tail + "\n\n" + p : p;
    bufStart =
      tail.length > 0
        ? bufStart + buf.length - p.length - tail.length - 2
        : pStart;
  }

  if (buf.length >= minSize) {
    chunks.push({
      content: buf,
      charStart: bufStart,
      charEnd: bufStart + buf.length,
    });
  }

  return chunks;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function lastNChars(s: string, n: number): string {
  if (s.length <= n) return s;
  const slice = s.slice(s.length - n);
  const breakIdx = slice.indexOf(" ");
  return breakIdx > 0 && breakIdx < 40 ? slice.slice(breakIdx + 1) : slice;
}
