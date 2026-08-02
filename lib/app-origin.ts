const DEFAULT_APP_ORIGIN = "https://fitnesss.online";

/** Canonical public origin used by metadata and install surfaces. */
export function getAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_ORIGIN).replace(
    /\/+$/,
    "",
  );
}
