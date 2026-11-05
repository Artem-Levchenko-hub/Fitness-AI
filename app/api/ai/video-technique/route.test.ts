import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getWorkout: vi.fn(),
  claimCapacity: vi.fn(),
  settleCapacity: vi.fn(),
  fetch: vi.fn<typeof fetch>(),
}));

vi.mock("@/lib/auth/require-user", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/repos/workouts.repo", () => ({
  getActiveWorkoutForUser: mocks.getWorkout,
}));
vi.mock("@/lib/ai/guard", () => ({
  claimAiCapacity: mocks.claimCapacity,
  settleAiCapacity: mocks.settleCapacity,
  capacityErrorResponse: () => new Response(null, { status: 429 }),
  capacityDuplicateResponse: () => new Response(null, { status: 409 }),
}));
vi.mock("@/lib/env", () => ({
  env: {
    AI_PROVIDER: "aitunnel",
    AI_API_KEY: "test-key",
    AI_BASE_URL: "https://api.aitunnel.ru/v1/",
    AI_MODEL: "deepseek-v4-pro-0813",
    AI_VIDEO_MODEL: "qwen3.8-omni-flash",
  },
}));

import { POST } from "./route";

const workoutId = "05fd948b-1ecb-4702-9002-b88a25495699";
const exerciseId = "b43566a5-61ef-488e-bab3-e353876f2801";
const requestId = "d5ba412f-c9ec-4752-8234-929b4bb9c221";
const mp4 = Uint8Array.of(0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0);

function request(body: BodyInit = mp4, contentLength?: string) {
  const headers = new Headers({ "Content-Type": "video/mp4" });
  if (contentLength) headers.set("Content-Length", contentLength);
  return new Request(
    `http://localhost/api/ai/video-technique?workoutId=${workoutId}&exerciseId=${exerciseId}&requestId=${requestId}`,
    { method: "POST", headers, body },
  );
}

describe("video technique analysis", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.getUser.mockResolvedValue({ id: "user-42" });
    mocks.getWorkout.mockResolvedValue({
      status: "completed",
      exercises: [{ id: exerciseId, exerciseNameRu: "Приседания" }],
    });
    mocks.claimCapacity.mockResolvedValue({ kind: "allowed", usageId: "usage-42" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends the owned exercise and clip to Qwen and returns the visible answer", async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      choices: [{ message: { content: "Следи за положением коленей." } }],
    }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ analysis: "Следи за положением коленей." });
    const [[url, init]] = mocks.fetch.mock.calls;
    expect(String(url)).toBe("https://api.aitunnel.ru/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "qwen3.8-omni-flash",
      user: "user-42",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: expect.stringContaining("Приседания") },
          { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAAEGZ0eXBpc29tAAAAAA==" } },
        ],
      }],
    });
    expect(mocks.settleCapacity).toHaveBeenCalledWith("usage-42", true);
  });

  it("rejects anonymous requests before contacting the provider", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects uploads for a workout the user does not own", async () => {
    mocks.getWorkout.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects an oversized Content-Length before claiming quota", async () => {
    expect((await POST(request(mp4, "7340033"))).status).toBe(413);
    expect(mocks.claimCapacity).not.toHaveBeenCalled();
  });

  it("releases quota for oversized bodies without a Content-Length header", async () => {
    const body = new Uint8Array(7 * 1024 * 1024 + 1);
    expect((await POST(request(body))).status).toBe(413);
    expect(mocks.settleCapacity).toHaveBeenCalledWith("usage-42", false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("releases quota for a non-video body", async () => {
    expect((await POST(request("not an MP4"))).status).toBe(400);
    expect(mocks.settleCapacity).toHaveBeenCalledWith("usage-42", false);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not read the upload when quota is exhausted", async () => {
    mocks.claimCapacity.mockResolvedValue({ kind: "quota_exceeded" });
    const upload = request();
    expect((await POST(upload)).status).toBe(429);
    expect(upload.bodyUsed).toBe(false);
  });

  it("does not call Qwen again for a duplicate request", async () => {
    mocks.claimCapacity.mockResolvedValue({ kind: "duplicate", status: "processing" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("releases quota when the provider returns an error", async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 503 }));
    expect((await POST(request())).status).toBe(502);
    expect(mocks.settleCapacity).toHaveBeenCalledWith("usage-42", false);
  });
});
