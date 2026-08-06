"use client";

import { Download, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { AppUpdateBanner } from "@/components/app/AppUpdateBanner";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 14;

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [appUpdateVisible, setAppUpdateVisible] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = Number(dismissed);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 86_400_000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      deferredRef.current = evt;
      setInstallPrompt(evt);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      setShowBanner(false);
      setInstallPrompt(null);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }, []);

  return (
    <>
      {children}
      <AppUpdateBanner onAvailabilityChange={setAppUpdateVisible} />
      <AnimatePresence>
        {showBanner && installPrompt && !appUpdateVisible ? (
          <motion.div
            initial={reduced ? false : { y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 100, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", damping: 25, stiffness: 300 }
            }
            className="fixed inset-x-0 bottom-20 z-50 mx-auto w-[calc(100%-2rem)] max-w-md md:bottom-6"
          >
            <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-lg">
              <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-full">
                <Download className="text-primary size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Установить приложение</p>
                <p className="text-muted-foreground text-xs">
                  Быстрый доступ с главного экрана
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleInstall}
                className="shrink-0"
              >
                Установить
              </Button>
              <button
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground shrink-0 p-1"
                aria-label="Закрыть"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
