import { describe, expect, it } from "vitest";

import { APP_UPDATE_MANIFEST } from "@/lib/app-update";

import { GET } from "./route";

describe("GET /api/app-updates", () => {
  it("отдаёт актуальные версии без кэширования", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    await expect(response.json()).resolves.toEqual(APP_UPDATE_MANIFEST);
  });
});
