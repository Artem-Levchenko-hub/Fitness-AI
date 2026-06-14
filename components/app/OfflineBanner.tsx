"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { formatOfflineSince, LAST_ONLINE_KEY } from "@/lib/pwa/offline-status";

/**
 * Неблокирующий бейдж офлайна (H15.2b, R-37/R-41).
 *
 * Пока есть сеть — компонент невидим и пишет в localStorage время последней
 * онлайн-загрузки. Когда сеть пропала — SW отдаёт закэшированную страницу
 * (H15.2a), а бейдж сверху честно сообщает «Офлайн · данные на <время>».
 * Контент под ним остаётся живым (fixed-оверлей, не модалка). Статусность —
 * иконкой + текстом, не только цветом (R-41).
 */
export function OfflineBanner() {
  // null = онлайн (бейдж скрыт). Строка = офлайн-подпись, зафиксированная в
  // момент потери сети (offline-данные не «свежеют», пока сети нет → считать
  // время в render нельзя — это и нечисто, и неверно). На сервере и в первом
  // клиентском кадре null → ноль hydration-mismatch; статус ставит эффект.
  const [label, setLabel] = useState<string | null>(null);

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
    };

    const goOffline = () => {
      setLabel(`Офлайн · ${formatOfflineSince(readSince(), Date.now())}`);
    };

    if (navigator.onLine) markOnline();
    else goOffline();

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (label == null) return null;

  return (
    <div
      data-offline-banner
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[env(safe-area-inset-top)]"
    >
      <div className="bg-muted text-muted-foreground border-border mt-2 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-sm">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </div>
    </div>
  );
}
