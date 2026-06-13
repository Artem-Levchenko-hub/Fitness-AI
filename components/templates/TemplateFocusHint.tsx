"use client";

import { Lightbulb, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { shouldShowFocusHint } from "@/lib/ai/focus-hint";

const STORAGE_KEY = "template-focus-dismissed";
const DISMISS_EVENT = "template-focus-dismiss";

/** Подписка на localStorage-флаг dismiss: меняется только через наш dismiss()
 *  (тот же таб) + стандартный `storage` (другой таб). useSyncExternalStore —
 *  чтобы читать внешнее хранилище без setState-в-effect (react-hooks правило) и
 *  без hydration mismatch (getServerSnapshot → null). */
function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** H5.7: одна строка-совет из ПОСЛЕДНЕГО AI-разбора предыдущей тренировки этого
 *  шаблона — на экране старта, чтобы замкнуть петлю «совет→следующая сессия».
 *  Dismissible и НЕ блокирует поток: «Начать тренировку» всегда доступна ниже.
 *  Закрытие запоминается по id разбора — новый разбор всплывает снова сам. */
export function TemplateFocusHint({
  focus,
  analysisId,
}: {
  focus: string;
  analysisId: string;
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
    <div className="bg-primary/5 border-primary/20 mb-4 flex items-start gap-3 rounded-xl border p-4">
      <div className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
        <Lightbulb className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-primary text-[10px] font-medium tracking-[0.18em] uppercase">
          Совет тренера к этой тренировке
        </p>
        <p className="text-foreground mt-1 text-sm leading-relaxed">{focus}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Скрыть совет"
        className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 flex size-14 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
