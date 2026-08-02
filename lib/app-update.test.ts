import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  compareVersions,
  getAvailableUpdate,
  parseVersion,
  readAndroidClientVersion,
  type AppReleaseInfo,
  APP_UPDATE_MANIFEST,
} from "./app-update";

const release: AppReleaseInfo = {
  version: "1.2.0",
  downloadUrl: "https://example.com/app.apk",
  releaseUrl: "https://example.com/release",
};

describe("app update versions", () => {
  it("сравнивает major, minor и patch", () => {
    expect(compareVersions("1.1.9", "1.2.0")).toBe(-1);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  });

  it("отбрасывает неоднозначные версии", () => {
    expect(parseVersion("1.02.0")).toBeNull();
    expect(compareVersions("latest", "1.2.0")).toBeNull();
  });

  it("возвращает релиз только для устаревшего клиента", () => {
    expect(getAvailableUpdate("1.1.0", release)).toEqual(release);
    expect(getAvailableUpdate("1.2.0", release)).toBeNull();
    expect(getAvailableUpdate("1.3.0", release)).toBeNull();
  });
});

describe("android client marker", () => {
  it("читает версию из TWA startUrl", () => {
    expect(
      readAndroidClientVersion("?client=android&appVersion=1.2.0"),
    ).toBe("1.2.0");
  });

  it("читает версию из callbackUrl после редиректа на вход", () => {
    const callbackUrl = encodeURIComponent(
      "/dashboard?client=android&appVersion=1.2.0",
    );
    expect(readAndroidClientVersion(`?callbackUrl=${callbackUrl}`)).toBe(
      "1.2.0",
    );
  });

  it("не принимает внешний callbackUrl или другой клиент", () => {
    expect(
      readAndroidClientVersion(
        "?callbackUrl=https%3A%2F%2Fevil.example%2F%3Fclient%3Dandroid%26appVersion%3D9.0.0",
      ),
    ).toBeNull();
    expect(readAndroidClientVersion("?client=web&appVersion=1.2.0")).toBeNull();
  });
});

it("синхронизирует Android release, TWA-маркер и versionCode", () => {
  const twa = JSON.parse(
    readFileSync(new URL("../android/twa-manifest.json", import.meta.url), "utf8"),
  ) as {
    appVersionName: string;
    appVersion: string;
    appVersionCode: number;
    startUrl: string;
  };
  const startUrl = new URL(twa.startUrl, "https://fitnesss.online");

  expect(twa.appVersionName).toBe(APP_UPDATE_MANIFEST.android.version);
  expect(twa.appVersion).toBe(twa.appVersionName);
  expect(startUrl.searchParams.get("client")).toBe("android");
  expect(startUrl.searchParams.get("appVersion")).toBe(twa.appVersionName);
  expect(twa.appVersionCode).toBe(5);
});
