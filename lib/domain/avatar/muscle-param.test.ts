import { describe, expect, it } from "vitest";

import { parseMuscleParam } from "./muscle-param";

describe("parseMuscleParam", () => {
  it("returns the key for a valid muscle group", () => {
    expect(parseMuscleParam("chest")).toBe("chest");
    expect(parseMuscleParam("back_lats")).toBe("back_lats");
  });

  it("returns null for an unknown key", () => {
    expect(parseMuscleParam("nope")).toBeNull();
    expect(parseMuscleParam("Chest")).toBeNull(); // регистр важен
  });

  it("returns null for undefined / empty", () => {
    expect(parseMuscleParam(undefined)).toBeNull();
    expect(parseMuscleParam("")).toBeNull();
  });

  it("collapses an array to its first element", () => {
    expect(parseMuscleParam(["quads", "chest"])).toBe("quads");
    expect(parseMuscleParam(["bogus"])).toBeNull();
    expect(parseMuscleParam([])).toBeNull();
  });
});
