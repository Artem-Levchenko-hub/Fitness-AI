"use client";

import { ChevronRight, MessageSquareText, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";

import { shouldShowFocusHint } from "@/lib/ai/focus-hint";

const STORAGE_KEY = "dashboard-trainer-voice-dismissed";
const DISMISS_EVENT = "dashboard-trainer-voice-dismiss";

/** Подписка на localStorage-флаг dismiss: меняется через наш dismiss() (тот же
 *  таб) + стандартный `storage` (другой таб). useSyncExternalStore — читать
 *  внешнее хранилище без setState-в-effect и без hydration mismatch
 *  (getServerSnapshot → null). Зеркало TemplateFocusHint (H5.7). */
function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** H11.2 — «голос тренера» на /dashboard: одна строка-совет
 *  (`nextSessionFocus` последнего разбора) над StartCard. Тренер, уже всё
 *  разобравший, говорит первым (столп 1). Отдельная dismissible-секция, а НЕ
 *  children-слот навигационной плитки: плитка — цельный `<Link>`, вложить в неё
 *  dismiss-кнопку = невалидный HTML и сломанный Tab/Enter (R-39). Здесь
 *  `<Link>` (тап → сам разбор) и `<button>` dismiss стоят бок о бок, оба ≥56px
 *  (R-41). Закрытие хранится по analysisId — новый разбор (новый id) всплывает
 *  снова сам (shouldShowFocusHint). */
export function TrainerVoiceBanner({
  focus,
  analysisId,
  href,
}: {
  focus: string;
  analysisId: string;
  href: string;
}) {
  const dismissedId = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY),
    () => null,
  );

  if (!shouldShowFocusHint(focus, analysisId, dismissedId)) return null;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, analysisId);
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  return (
    <div
      data-testid="dashboard-trainer-voice"
      className="bg-primary/5 border-primary/20 mb-6 flex items-stretch gap-2 rounded-xl border"
    >
      <Link
        href={href}
        className="hover:bg-primary/10 flex min-h-14 flex-1 items-center gap-3 rounded-l-xl p-4 transition-colors"
      >
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <MessageSquareText className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-primary block text-[10px] font-medium tracking-[0.18em] uppercase">
            Тренер
          </span>
          <span className="text-foreground mt-0.5 block truncate text-sm leading-relaxed">
            {focus}
          </span>
        </span>
        <ChevronRight
          className="text-muted-foreground size-4 shrink-0"
          aria-hidden="true"
        />
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть совет тренера"
        className="text-muted-foreground hover:text-foreground flex size-14 shrink-0 items-center justify-center rounded-r-xl transition-colors"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
