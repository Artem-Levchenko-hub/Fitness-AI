import { describe, expect, it } from "vitest";

import { buildFollowUpMessages } from "./follow-up";

describe("buildFollowUpMessages", () => {
  it("returns null when question is empty", () => {
    expect(buildFollowUpMessages("разбор", "")).toBeNull();
  });

  it("returns null when question is whitespace only", () => {
    expect(buildFollowUpMessages("разбор", "   \n  ")).toBeNull();
  });

  it("leads with the analysis as an assistant message, then the user question", () => {
    const msgs = buildFollowUpMessages("# Разбор\nЖим упал", "почему упал жим?");
    expect(msgs).toEqual([
      { role: "assistant", content: "# Разбор\nЖим упал" },
      { role: "user", content: "почему упал жим?" },
    ]);
  });

  it("trims the question", () => {
    const msgs = buildFollowUpMessages("разбор", "  что по сну?  ");
    expect(msgs?.[1]).toEqual({ role: "user", content: "что по сну?" });
  });

  it("omits the assistant message when analysis text is empty (still asks)", () => {
    const msgs = buildFollowUpMessages("   ", "почему упал жим?");
    expect(msgs).toEqual([{ role: "user", content: "почему упал жим?" }]);
  });

  it("trims the analysis text in the assistant message", () => {
    const msgs = buildFollowUpMessages("  разбор  ", "вопрос");
    expect(msgs?.[0]).toEqual({ role: "assistant", content: "разбор" });
  });
});
