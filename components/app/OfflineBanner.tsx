"use client";

import { CloudOff, Loader2, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  formatOfflineSince,
  LAST_ONLINE_KEY,
  subscribeOnline,
} from "@/lib/pwa/offline-status";
import { listPending, remove } from "@/lib/storage/outbox";
import {
  drainOutbox,
  finishFormData,
  recordSetFormData,
  type DrainReplayers,
} from "@/lib/storage/outbox-drain";
import {
  recordSetAction,
  replayFinishWorkoutAction,
} from "@/server/actions/workouts";

/**
 * Неблокирующий бейдж сетевого статуса (H15.2b офлайн + H15.4 синхронизация).
 *
 * ЕДИНСТВЕННЫЙ носитель online/offline-listener в (app)-слое (carrier-reuse,
 * урок H4.3 — не плодить второй `window 'online'`). Три состояния:
 *  • офлайн → «Офлайн · данные на <время>» (R-37/R-41, контент под живой);
 *  • реконнект с очередью → дренаж outbox + спиннер «Синхронизация…»;
 *  • остались несинхронизированные → «Не синхронизировано: N · Повторить».
 * Когда сеть есть и очередь пуста — компонент невидим (ноль hydration-mismatch:
 * на сервере и в первом кадре всё в дефолте → null).
 */
export function OfflineBanner() {
  // null = онлайн (офлайн-бейдж скрыт). Строка = офлайн-подпись, зафиксированная
  // в момент потери сети (offline-данные не «свежеют» без сети → считать время в
  // render нельзя). На сервере/первом кадре null → ноль hydration-mismatch.
  const [label, setLabel] = useState<string | null>(null);
  // H15.4 — несинхронизированные офлайн-мутации и идущий дренаж.
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Гард от наложения дренажей (online-событие + on-mount + retry одновременно).
  const syncingRef = useRef(false);

  // H15.4 — дренаж очереди: реплеит каждую мутацию через ТОТ ЖЕ server-action
  // (recordSetAction / replayFinishWorkoutAction) под тем же clientId →
  // идемпотентно (БД дедупит по client_set_id / status=active). Успех ⇒ удаляем
  // из outbox; сбой ⇒ оставляем (столп 4 — подход не теряется).
  const runDrain = useCallback(async () => {
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    syncingRef.current = true;
    setSyncing(true);
    try {
      const pending = await listPending();
      if (pending.length === 0) {
        setPendingCount(0);
        return;
      }
      setPendingCount(pending.length);

      const replayers: DrainReplayers = {
        recordSet: async (m) => {
          const state = await recordSetAction(
            { status: "idle" },
            recordSetFormData(m.payload),
          );
          // Успех = idle; ошибка валидации (error) → оставить (не зацикливаем:
          // дренаж бьёт лишь на online-событие/маунт/повтор, не в тугом цикле).
          return state.status === "idle";
        },
        finishWorkout: async (m) => {
          await replayFinishWorkoutAction(finishFormData(m.payload));
          return true;
        },
        remove,
      };

      await drainOutbox(pending, replayers);
      setPendingCount((await listPending()).length);
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readSince = (): number | null => {
      const raw = window.localStorage.getItem(LAST_ONLINE_KEY);
      if (raw == null) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };

    const markOnline = () => {
      try {
        window.localStorage.setItem(LAST_ONLINE_KEY, String(Date.now()));
      } catch {
        /* приватный режим / квота — бейдж просто покажет «сохранённые данные» */
      }
      setLabel(null);
      // Сеть вернулась → опустошаем очередь офлайн-мутаций.
      void runDrain();
    };

    const goOffline = () => {
      setLabel(`Офлайн · ${formatOfflineSince(readSince(), Date.now())}`);
    };

    if (navigator.onLine) {
      markOnline(); // online на маунте → metка времени + сразу дренаж очереди
    } else {
      goOffline();
      // Офлайн на маунте: показать счётчик незасинканных (дренаж — по reconnect).
      void listPending().then((p) => setPendingCount(p.length));
    }

    // Единый санкционированный носитель reconnect-сигнала (R-01/R-04) — НЕ
    // плодим второй `window 'online'`-листенер (урок H4.3).
    return subscribeOnline({ onOnline: markOnline, onOffline: goOffline });
  }, [runDrain]);

  // Невидим, когда онлайн, нечего синкать и дренаж не идёт.
  if (label == null && !syncing && pendingCount === 0) return null;

  return (
    <div
      data-offline-banner
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[env(safe-area-inset-top)]"
    >
      <div className="bg-muted text-muted-foreground border-border mt-2 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-sm">
        {label != null ? (
          <>
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
          </>
        ) : syncing ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
            <span>Синхронизация…</span>
          </>
        ) : (
          <>
            <CloudOff className="size-4 shrink-0" aria-hidden />
            <span>Не синхронизировано: {pendingCount}</span>
            <button
              type="button"
              onClick={() => void runDrain()}
              className="text-foreground inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Повторить
            </button>
          </>
        )}
      </div>
    </div>
  );
}
