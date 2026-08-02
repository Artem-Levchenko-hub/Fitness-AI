"use client";

import { Download, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ANDROID_CLIENT_VERSION_KEY,
  APP_UPDATE_DISMISS_KEY,
  getAvailableUpdate,
  parseVersion,
  readAndroidClientVersion,
  type AppReleaseInfo,
  type AppUpdateManifest,
} from "@/lib/app-update";

const DISMISS_MS = 24 * 60 * 60 * 1_000;

function isDismissed(version: string, now: number): boolean {
  try {
    const raw = localStorage.getItem(APP_UPDATE_DISMISS_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as { version?: unknown; until?: unknown };
    return (
      value.version === version &&
      typeof value.until === "number" &&
      value.until > now
    );
  } catch {
    return false;
  }
}

export function AppUpdateBanner({
  onAvailabilityChange,
}: {
  onAvailabilityChange?: (available: boolean) => void;
}) {
  const [update, setUpdate] = useState<AppReleaseInfo | null>(null);

  useEffect(() => {
    const marker = readAndroidClientVersion(window.location.search);
    if (marker) {
      localStorage.setItem(ANDROID_CLIENT_VERSION_KEY, marker);
      const url = new URL(window.location.href);
      if (url.searchParams.get("client") === "android") {
        url.searchParams.delete("client");
        url.searchParams.delete("appVersion");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    }

    const installedVersion =
      marker ?? localStorage.getItem(ANDROID_CLIENT_VERSION_KEY);
    if (!installedVersion || !parseVersion(installedVersion)) return;

    const controller = new AbortController();
    void fetch("/api/app-updates", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Update check failed: ${response.status}`);
        return (await response.json()) as AppUpdateManifest;
      })
      .then((manifest) => {
        const available = getAvailableUpdate(installedVersion, manifest.android);
        if (available && !isDismissed(available.version, Date.now())) {
          setUpdate(available);
          onAvailabilityChange?.(true);
        }
      })
      .catch(() => {
        // Проверка необязательная: без сети приложение продолжает работу.
      });

    return () => {
      controller.abort();
      onAvailabilityChange?.(false);
    };
  }, [onAvailabilityChange]);

  const dismiss = useCallback(() => {
    if (!update) return;
    localStorage.setItem(
      APP_UPDATE_DISMISS_KEY,
      JSON.stringify({ version: update.version, until: Date.now() + DISMISS_MS }),
    );
    setUpdate(null);
    onAvailabilityChange?.(false);
  }, [onAvailabilityChange, update]);

  if (!update) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[60] mx-auto w-[calc(100%-2rem)] max-w-md md:bottom-6"
      role="status"
      aria-live="polite"
      data-app-update-banner
    >
      <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-lg">
        <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-full">
          <Download className="text-primary size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Доступна версия {update.version}</p>
          <p className="text-muted-foreground text-xs">
            Android попросит подтвердить установку
          </p>
        </div>
        <Button className="h-11" asChild>
          <a href={update.downloadUrl} target="_blank" rel="noreferrer">
            Обновить
          </a>
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground flex size-11 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Напомнить об обновлении позже"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
