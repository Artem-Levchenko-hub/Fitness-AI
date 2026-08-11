import { describe, expect, it } from "vitest";

import { fitCoachMessagesForModel } from "./coach-conversation";

describe("fitCoachMessagesForModel", () => {
  it("keeps the newest complete turn within both limits", () => {
    const messages = [
      { role: "user" as const, content: "old question" },
      { role: "assistant" as const, content: "old answer" },
      { role: "user" as const, content: "new question" },
    ];

    expect(fitCoachMessagesForModel(messages, 2, 100)).toEqual([
      { role: "user", content: "new question" },
    ]);
  });

  it("does not send a leading orphan assistant message", () => {
    const messages = [
      { role: "user" as const, content: "first" },
      { role: "assistant" as const, content: "reply" },
      { role: "user" as const, content: "latest" },
    ];

    expect(fitCoachMessagesForModel(messages, 2, 100)).toEqual([
      { role: "user", content: "latest" },
    ]);
  });
});
