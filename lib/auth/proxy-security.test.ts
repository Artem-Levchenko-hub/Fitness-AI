import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: (request: NextRequest) => Response) => handler,
  }),
}));

import proxy from "../../proxy";

function request(url: string, auth: unknown = null): NextRequest {
  const req = new NextRequest(url);
  Object.defineProperty(req, "auth", { value: auth });
  return req;
}

describe("proxy security headers and deep links", () => {
  it("ставит nonce CSP на публичный HTML response", async () => {
    const response = (await proxy(request("https://fitnesss.online/login"), {} as never)) as Response;
    const csp = response.headers.get("Content-Security-Policy");
    const forwardedNonce = response.headers.get("x-middleware-request-x-nonce");

    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(forwardedNonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(csp).toContain(`'nonce-${forwardedNonce}'`);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("сохраняет deep link для любого app-route, включая billing", async () => {
    const response = (await proxy(
      request("https://fitnesss.online/billing?source=upgrade"),
      {} as never,
    )) as Response;

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://fitnesss.online/login?callbackUrl=%2Fbilling%3Fsource%3Dupgrade",
    );
  });
});
