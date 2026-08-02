const MAX_ENDPOINT_LENGTH = 2_048;

const TRUSTED_PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
]);

const TRUSTED_PUSH_HOST_SUFFIXES = [
  ".push.services.mozilla.com",
  ".push.apple.com",
] as const;

/**
 * Web Push endpoints are server-side destinations. Accept only HTTPS endpoints
 * operated by the browser push services we support; a generic URL validator
 * would turn notification delivery into authenticated blind SSRF.
 */
export function normalizePushEndpoint(value: string): string {
  if (value.length === 0 || value.length > MAX_ENDPOINT_LENGTH) {
    throw new TypeError("Invalid push endpoint length");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("Invalid push endpoint URL");
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    (url.port !== "" && url.port !== "443") ||
    url.hash !== ""
  ) {
    throw new TypeError("Unsafe push endpoint URL");
  }

  const host = url.hostname.toLowerCase();
  const trusted =
    TRUSTED_PUSH_HOSTS.has(host) ||
    TRUSTED_PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!trusted) {
    throw new TypeError("Unsupported push service");
  }

  if (url.pathname === "/" || url.pathname === "") {
    throw new TypeError("Push endpoint path is missing");
  }

  url.hostname = host;
  return url.toString();
}

export function isSafePushEndpoint(value: string): boolean {
  try {
    normalizePushEndpoint(value);
    return true;
  } catch {
    return false;
  }
}

export const PUSH_SUBSCRIPTIONS_PER_USER_LIMIT = 8;
