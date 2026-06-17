/**
 * One-time tooling: match our system exercises to ExerciseDB OSS and download
 * their demo GIFs into `public/exercises-demos/<slug>.gif`, then emit the
 * generated manifest `lib/domain/exercises/demos.generated.ts`.
 *
 * The live API is "exploration only" (rate-limited) — we hit it ONCE here to
 * download, never at runtime. Assets are committed and self-hosted.
 *
 * Run:  pnpm tsx scripts/fetch-exercise-demos.ts [--report-only] [--force]
 *   --report-only  page + match + print coverage, do NOT download or write
 *   --force        re-download even if the gif already exists
 *
 * Matching: normalized exact → token-sorted (word-order-insensitive) →
 * curated OVERRIDES (slug → ExerciseDB name or exerciseId). Unmatched slugs
 * are printed with the closest suggestions so OVERRIDES can be filled in.
 */

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";

import { EXERCISES } from "../db/seed/exercises.seed";

const API_BASE = "https://oss.exercisedb.dev/api/v1/exercises";
const PAGE_SIZE = 25; // API caps page size at 25 regardless of `limit`
const PAGE_DELAY_MS = 600; // polite gap between pages — the OSS API rate-limits hard
const CACHE_PATH = path.join(process.cwd(), "scripts", ".cache", "exercisedb-catalogue.json");
const OUT_DIR = path.join(process.cwd(), "public", "exercises-demos");
const MANIFEST_PATH = path.join(
  process.cwd(),
  "lib",
  "domain",
  "exercises",
  "demos.generated.ts",
);

/** Curated fixes for names that don't match by normalization. Value is either
 *  an ExerciseDB `exerciseId` (7-char id) or an exact ExerciseDB `name`.
 *  Filled in after the first --report-only run. */
const OVERRIDES: Record<string, string> = {
  "decline-bench-press": "GrO65fd",
  "dips-chest": "9WTm7dq",
  "dumbbell-flyes": "yz9nUhF",
  "cable-crossover": "0CXGHya",
  deadlift: "ila4NZS",
  "deadlift-romanian": "wQ2c4XD",
  "barbell-row": "eZyBC3j",
  "dumbbell-row": "C0MA9bC",
  "lat-pulldown": "LEprlgG",
  "t-bar-row": "aaXr7ld",
  "overhead-press-barbell": "kTbSH9h",
  "overhead-press-dumbbell": "znQUdHY",
  "arnold-press": "Xy4jlWA",
  "front-raise": "3eGE2JC",
  "rear-delt-fly": "8DiFDVA",
  "upright-row": "UDlhcO8",
  "dumbbell-curl": "NbVPDMW",
  "hammer-curl": "slDvUAU",
  "preacher-curl": "qOgPVf6",
  "concentration-curl": "gvsWLQw",
  "close-grip-bench-press": "J6Dx1Mu",
  "skull-crusher": "h8LFzo9",
  "tricep-pushdown": "gAwDzB3",
  "overhead-tricep-extension": "1xHyxys",
  "dips-triceps": "X6C6i5Y",
  "tricep-kickback": "W6PxUkg",
  "wrist-curl": "82LxxkW",
  "reverse-wrist-curl": "BLCvwr2",
  "farmer-walk": "qPEzJjA",
  "back-squat": "qXTaZnJ",
  "front-squat": "zG0zs85",
  "goblet-squat": "yn8yg1r",
  "leg-press": "10Z2DXU",
  "lunge-walking": "IZVHb27",
  "leg-extension": "my33uHU",
  "step-up": "aXtJhlg",
  "leg-curl-lying": "17lJ1kr",
  "leg-curl-seated": "Zg3XY7P",
  "good-morning": "XlZ4lAC",
  "glute-bridge": "qKBpF7I",
  "calf-raise-standing": "8ozhUIZ",
  "calf-raise-seated": "bOOdeyc",
  plank: "hCjGsRQ",
  "side-plank": "5VXmnV5",
  "ab-wheel-rollout": "NAgVB3t",
  "cable-crunch": "WW95auq",
};

type ApiExercise = { exerciseId: string; name: string; gifUrl: string };
type ApiListResponse = {
  data?: ApiExercise[];
  meta?: { hasNextPage?: boolean; nextCursor?: string | null };
};

const args = new Set(process.argv.slice(2));
const REPORT_ONLY = args.has("--report-only");
const FORCE = args.has("--force");
const REFRESH = args.has("--refresh");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenKey(raw: string): string {
  return normalize(raw).split(" ").filter(Boolean).sort().join(" ");
}

function tokenSet(raw: string): Set<string> {
  return new Set(normalize(raw).split(" ").filter(Boolean));
}

/** Jaccard overlap of word sets — used only to suggest near-misses. */
function similarity(a: string, b: string): number {
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : inter / union;
}

async function fetchJson<T>(url: string, attempt = 1): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000); // R-10 timeout
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "fitness-saas-demo-fetch" },
      signal: controller.signal,
    });
    if (res.status === 429) {
      // Rate limited — honor Retry-After, else exponential backoff.
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(30_000, 2_000 * 2 ** (attempt - 1));
      if (attempt <= 6) {
        console.log(`  429 — backing off ${Math.round(waitMs / 1000)}s (attempt ${attempt})`);
        await sleep(waitMs);
        return fetchJson<T>(url, attempt + 1);
      }
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 3 && (err as Error).name === "AbortError") {
      await sleep(500 * attempt);
      return fetchJson<T>(url, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllExercises(): Promise<ApiExercise[]> {
  // Disk cache: the OSS API rate-limits hard, so we page it once and reuse.
  if (!REFRESH && (await fileExists(CACHE_PATH))) {
    const cached = JSON.parse(await readFile(CACHE_PATH, "utf8")) as ApiExercise[];
    console.log(`Using cached catalogue (${cached.length} exercises). Pass --refresh to re-fetch.`);
    return cached;
  }

  const all: ApiExercise[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 200; page++) {
    const url: string = `${API_BASE}?limit=${PAGE_SIZE}${cursor ? `&after=${cursor}` : ""}`;
    const json: ApiListResponse = await fetchJson<ApiListResponse>(url);
    const data: ApiExercise[] = json?.data ?? [];
    all.push(...data);
    if (page % 10 === 0) process.stdout.write(`\r  paged ${all.length}…`);
    if (!json?.meta?.hasNextPage || !json?.meta?.nextCursor) break;
    cursor = json.meta.nextCursor ?? null;
    await sleep(PAGE_DELAY_MS);
  }
  console.log(`\r  paged ${all.length} total.       `);

  await mkdir(path.dirname(CACHE_PATH), { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(all), "utf8");
  return all;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadGif(url: string, dest: string, attempt = 1): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      if (attempt <= 4 && (res.status === 429 || res.status >= 500)) {
        clearTimeout(timer);
        await sleep(Math.min(15_000, 1_500 * 2 ** (attempt - 1)));
        return downloadGif(url, dest, attempt + 1);
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
  } finally {
    clearTimeout(timer);
  }
}

function resolveMatch(
  nameEn: string,
  slug: string,
  byNorm: Map<string, ApiExercise>,
  byTokens: Map<string, ApiExercise>,
  byId: Map<string, ApiExercise>,
): ApiExercise | null {
  const override = OVERRIDES[slug];
  if (override) {
    return (
      byId.get(override) ??
      byNorm.get(normalize(override)) ??
      byTokens.get(tokenKey(override)) ??
      null
    );
  }
  return byNorm.get(normalize(nameEn)) ?? byTokens.get(tokenKey(nameEn)) ?? null;
}

async function main() {
  console.log(`Fetching ExerciseDB OSS catalogue (page size ${PAGE_SIZE})…`);
  const api = await fetchAllExercises();
  console.log(`Fetched ${api.length} exercises.`);

  const byNorm = new Map<string, ApiExercise>();
  const byTokens = new Map<string, ApiExercise>();
  const byId = new Map<string, ApiExercise>();
  for (const ex of api) {
    byId.set(ex.exerciseId, ex);
    const n = normalize(ex.name);
    const t = tokenKey(ex.name);
    if (!byNorm.has(n)) byNorm.set(n, ex);
    if (!byTokens.has(t)) byTokens.set(t, ex);
  }

  const matched: { slug: string; ex: ApiExercise }[] = [];
  const unmatched: { slug: string; nameEn: string }[] = [];
  for (const seed of EXERCISES) {
    const ex = resolveMatch(seed.nameEn, seed.slug, byNorm, byTokens, byId);
    if (ex) matched.push({ slug: seed.slug, ex });
    else unmatched.push({ slug: seed.slug, nameEn: seed.nameEn });
  }

  console.log(
    `\nCoverage: ${matched.length}/${EXERCISES.length} matched, ${unmatched.length} unmatched.`,
  );

  if (unmatched.length) {
    console.log(`\nUnmatched (with closest suggestions):`);
    for (const u of unmatched) {
      const ranked = api
        .map((ex) => ({ ex, score: similarity(u.nameEn, ex.name) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((r) => `${r.ex.name} [${r.ex.exerciseId}] ${r.score.toFixed(2)}`);
      console.log(`  ${u.slug} ("${u.nameEn}")`);
      for (const s of ranked) console.log(`      ↳ ${s}`);
    }
  }

  if (REPORT_ONLY) {
    console.log(`\n--report-only: skipping download + manifest write.`);
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  for (const { slug, ex } of matched) {
    const dest = path.join(OUT_DIR, `${slug}.gif`);
    if (!FORCE && (await fileExists(dest))) {
      skipped++;
      continue;
    }
    try {
      await downloadGif(ex.gifUrl, dest);
      downloaded++;
      process.stdout.write(".");
      await sleep(150);
    } catch (err) {
      console.error(`\nFailed ${slug} <- ${ex.gifUrl}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDownloaded ${downloaded}, skipped ${skipped} (already present).`);

  const entries = matched
    .slice()
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(
      ({ slug }) =>
        `  ${JSON.stringify(slug)}: { gif: ${JSON.stringify(`/exercises-demos/${slug}.gif`)} },`,
    )
    .join("\n");

  const manifest = `/**
 * AUTO-GENERATED by scripts/fetch-exercise-demos.ts — do not edit by hand.
 * Maps a system-exercise slug to its self-hosted demo GIF (public path).
 * Source: ExerciseDB OSS (static.exercisedb.dev). Keyed by stable slug.
 */
export type ExerciseDemoAsset = { gif: string };

export const EXERCISE_DEMOS: Record<string, ExerciseDemoAsset> = {
${entries}
};
`;
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, manifest, "utf8");
  console.log(`Wrote manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
