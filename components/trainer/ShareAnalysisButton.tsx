"use client";

import { Check, Copy, EyeOff, Loader2, Share2 } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  disableAnalysisSharingAction,
  enableAnalysisSharingAction,
} from "@/server/actions/trainer";

/** F6 run-4b: кнопка публичного шеринга разбора. При включении показывает
 *  ссылку /a/{token} (capability-токен) + копирование в буфер. Рендерится
 *  ТОЛЬКО на странице владельца — публичная /a/[token] переиспользует
 *  TrainerResultCard без этой кнопки. */
export function ShareAnalysisButton({
  analysisId,
  initialToken,
}: {
  analysisId: string;
  initialToken: string | null;
}) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // origin доступен только на клиенте. useSyncExternalStore — hydration-safe:
  // на сервере "" , после гидрации — реальный window.location.origin.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const shareUrl = token ? `${origin}/a/${token}` : "";

  function enable() {
    setError(null);
    startTransition(async () => {
      const { token: next } = await enableAnalysisSharingAction(analysisId);
      if (next) setToken(next);
      else setError("Не удалось включить доступ по ссылке.");
    });
  }

  function disable() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const { ok } = await disableAnalysisSharingAction(analysisId);
      if (ok) setToken(null);
      else setError("Не удалось отключить доступ.");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Не удалось скопировать — выдели и скопируй вручную.");
    }
  }

  if (!token) {
    return (
      <div className="mt-4 space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={enable}
          disabled={pending}
          className="min-h-14 w-full"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Поделиться разбором
        </Button>
        {error ? (
          <p className="text-destructive text-xs">{error}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Создаст публичную ссылку на этот разбор — без входа, без ваших
            личных данных.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-border mt-4 space-y-3 rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
        Публичная ссылка активна
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="bg-muted text-foreground border-border min-h-14 flex-1 rounded-lg border px-3 text-sm"
          aria-label="Ссылка на разбор"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={copy}
          className="min-h-14 shrink-0"
        >
          {copied ? (
            <>
              <Check className="size-4" /> Скопировано
            </>
          ) : (
            <>
              <Copy className="size-4" /> Копировать
            </>
          )}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        onClick={disable}
        disabled={pending}
        className="text-muted-foreground min-h-14 w-full"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <EyeOff className="size-4" />
        )}
        Сделать приватным
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
