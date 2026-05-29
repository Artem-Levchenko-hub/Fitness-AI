import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../db/schema";
import { chunkText } from "../lib/ai/rag/chunker";
import { embedTexts } from "../lib/ai/rag/embed";
import {
  KNOWLEDGE_DOMAINS,
  type KnowledgeDomain,
} from "../db/schema/knowledge";

type Args = {
  path: string;
  title: string;
  author?: string;
  domain: KnowledgeDomain;
  language: string;
};

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        flags[a.slice(2)] = "true";
      }
    } else {
      positional.push(a);
    }
  }

  const path = positional[0];
  if (!path) {
    throw new Error(
      "Usage: pnpm tsx scripts/ingest-book.ts <pdf-path> --title=X --author=Y --domain=training --language=ru",
    );
  }

  const domain = (flags.domain ?? "training") as KnowledgeDomain;
  if (!KNOWLEDGE_DOMAINS.includes(domain)) {
    throw new Error(
      `--domain must be one of: ${KNOWLEDGE_DOMAINS.join(", ")}, got: ${domain}`,
    );
  }

  return {
    path,
    title: flags.title ?? basename(path).replace(/\.[^.]+$/, ""),
    author: flags.author,
    domain,
    language: flags.language ?? "en",
  };
}

async function extractPdfText(path: string): Promise<string> {
  const buffer = await readFile(path);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  console.log(`[ingest] PDF: ${args.path}`);
  console.log(
    `[ingest] meta: title="${args.title}", author="${args.author ?? "?"}", domain=${args.domain}, lang=${args.language}`,
  );

  console.log("[ingest] extracting text…");
  const text = await extractPdfText(args.path);
  console.log(`[ingest] extracted ${text.length} chars`);

  console.log("[ingest] chunking…");
  const chunks = chunkText(text, { targetSize: 1000, overlap: 200 });
  console.log(`[ingest] ${chunks.length} chunks`);

  console.log("[ingest] embedding via Gemini (batches of 64)…");
  const embeddings = await embedTexts(chunks.map((c) => c.content));
  console.log(`[ingest] got ${embeddings.length} embeddings`);

  const sql = postgres(dbUrl, { max: 1, prepare: false });
  const db = drizzle(sql, { schema, casing: "snake_case" });

  try {
    const [source] = await db
      .insert(schema.knowledgeSources)
      .values({
        title: args.title,
        author: args.author,
        domain: args.domain,
        language: args.language,
        sourcePath: args.path,
      })
      .returning();
    console.log(`[ingest] source inserted: ${source.id}`);

    const rows = chunks.map((c, i) => ({
      sourceId: source.id,
      chunkIndex: i,
      content: c.content,
      embedding: embeddings[i],
      metadata: { charStart: c.charStart, charEnd: c.charEnd },
    }));

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.insert(schema.knowledgeChunks).values(rows.slice(i, i + BATCH));
      console.log(
        `[ingest] inserted ${Math.min(i + BATCH, rows.length)}/${rows.length} chunks`,
      );
    }
    console.log("[ingest] done");
  } catch (e) {
    console.error("[ingest] failed:", e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
