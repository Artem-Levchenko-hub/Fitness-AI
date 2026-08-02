import { describe, expect, it } from "vitest";

import {
  isSafePushEndpoint,
  normalizePushEndpoint,
} from "./endpoint-policy";

describe("push endpoint policy", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/example",
    "https://updates.push.services.mozilla.com/wpush/v2/example",
    "https://web.push.apple.com/QH8/example",
  ])("accepts a supported browser push service: %s", (endpoint) => {
    expect(isSafePushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "https://127.0.0.1:8443/internal",
    "https://localhost/internal",
    "https://169.254.169.254/latest/meta-data",
    "http://fcm.googleapis.com/fcm/send/example",
    "https://fcm.googleapis.com.evil.example/fcm/send/example",
    "https://user:pass@fcm.googleapis.com/fcm/send/example",
    "file:///etc/passwd",
  ])("rejects an SSRF-capable endpoint: %s", (endpoint) => {
    expect(isSafePushEndpoint(endpoint)).toBe(false);
  });

  it("normalizes the trusted host and default TLS port", () => {
    expect(
      normalizePushEndpoint(
        "https://FCM.GOOGLEAPIS.COM:443/fcm/send/example?key=value",
      ),
    ).toBe("https://fcm.googleapis.com/fcm/send/example?key=value");
  });
});
