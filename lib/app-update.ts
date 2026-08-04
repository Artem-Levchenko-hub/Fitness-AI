export const ANDROID_CLIENT_VERSION_KEY = "fitness-ai:android-client-version";
export const APP_UPDATE_DISMISS_KEY = "fitness-ai:app-update-dismissed";

export interface AppReleaseInfo {
  version: string;
  downloadUrl: string;
  releaseUrl: string;
}

export interface AppUpdateManifest {
  schemaVersion: 1;
  android: AppReleaseInfo;
  windows: AppReleaseInfo;
}

export const APP_UPDATE_MANIFEST: AppUpdateManifest = {
  schemaVersion: 1,
  android: {
    version: "1.2.1",
    downloadUrl:
      "https://github.com/Artem-Levchenko-hub/Fitness-AI/releases/download/v1.2.1/Vibe-trainer-Android-v1.2.1.apk",
    releaseUrl:
      "https://github.com/Artem-Levchenko-hub/Fitness-AI/releases/tag/v1.2.1",
  },
  windows: {
    version: "1.2.1",
    downloadUrl:
      "https://github.com/Artem-Levchenko-hub/Fitness-AI/releases/download/v1.2.1/Vibe-trainer-Windows-x64-Setup-v1.2.1.exe",
    releaseUrl:
      "https://github.com/Artem-Levchenko-hub/Fitness-AI/releases/tag/v1.2.1",
  },
};

const VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(version: string): [number, number, number] | null {
  const match = VERSION_RE.exec(version);
  if (!match) return null;
  const parts = match.slice(1).map(Number) as [number, number, number];
  return parts.every(Number.isSafeInteger) ? parts : null;
}

export function compareVersions(left: string, right: string): number | null {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function getAvailableUpdate(
  installedVersion: string,
  release: AppReleaseInfo,
): AppReleaseInfo | null {
  return compareVersions(installedVersion, release.version) === -1
    ? release
    : null;
}

function readVersionFromParams(params: URLSearchParams): string | null {
  if (params.get("client") !== "android") return null;
  const version = params.get("appVersion");
  return version && parseVersion(version) ? version : null;
}

/** Читает маркер напрямую из TWA startUrl или из callbackUrl страницы входа. */
export function readAndroidClientVersion(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const direct = readVersionFromParams(params);
  if (direct) return direct;

  const callbackUrl = params.get("callbackUrl");
  if (!callbackUrl) return null;
  try {
    const nested = new URL(callbackUrl, "https://fitnesss.online");
    return nested.origin === "https://fitnesss.online"
      ? readVersionFromParams(nested.searchParams)
      : null;
  } catch {
    return null;
  }
}
