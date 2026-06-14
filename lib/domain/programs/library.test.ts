import { describe, expect, it } from "vitest";

import { EXERCISES } from "@/db/seed/exercises.seed";
import {
  LIBRARY_PROGRAMS,
  getLibraryProgram,
  libraryExerciseSlugs,
} from "./library";

describe("library catalog integrity", () => {
  const seedSlugs = new Set(EXERCISES.map((e) => e.slug));

  it("every program references only existing system exercises", () => {
    const missing = libraryExerciseSlugs().filter((s) => !seedSlugs.has(s));
    expect(missing).toEqual([]);
  });

  it("has unique program slugs", () => {
    const slugs = LIBRARY_PROGRAMS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every program has at least one day and every day at least one item", () => {
    for (const p of LIBRARY_PROGRAMS) {
      expect(p.days.length).toBeGreaterThan(0);
      for (const d of p.days) expect(d.items.length).toBeGreaterThan(0);
    }
  });

  it("resolves a program by slug and misses cleanly", () => {
    expect(getLibraryProgram("full-body-3x-beginner")?.name).toBeTruthy();
    expect(getLibraryProgram("nope")).toBeUndefined();
  });
});
