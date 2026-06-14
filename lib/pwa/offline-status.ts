/**
 * Офлайн-индикатор свежести данных (H15.2b).
 *
 * SW (public/sw.js) отдаёт офлайн последнюю закэшированную версию страницы
 * (network-first, H15.2a). Эта подпись честно говорит, НА КАКОЙ МОМЕНТ эти
 * данные актуальны: время последней успешной онлайн-загрузки клиента (его
 * пишет OfflineBanner в localStorage по ключу ниже). Время выдумывать нельзя —
 * нет записи → «сохранённые данные» без даты (R-10/R-37).
 */

/** Ключ localStorage с эпохой (ms) последней онлайн-загрузки. */
export const LAST_ONLINE_KEY = "fit:last-online";

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Подпись «на какой момент данные», относительно `now`.
 * Зеркалит идиому workout-history (сегодня/вчера/дата). `now` — явный параметр
 * (тестируемо, без Date.now внутри). Битый/отсутствующий `ts` → без времени.
 */
export function formatOfflineSince(ts: number | null, now: number): string {
  if (ts == null || !Number.isFinite(ts)) return "сохранённые данные";

  const then = new Date(ts);
  const ref = new Date(now);

  if (sameCalendarDay(then, ref)) {
    return `данные на сегодня ${hhmm(then)}`;
  }

  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);
  if (sameCalendarDay(then, yesterday)) {
    return `данные на вчера ${hhmm(then)}`;
  }

  const date = then.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  return `данные на ${date}`;
}

/**
 * Единый reconnect-сигнал (H15.4 sharpen).
 *
 * ЕДИНСТВЕННЫЙ санкционированный способ подписаться на смену сетевого статуса в
 * (app)-слое — глубокий модуль (R-01), прячущий проводку `window`
 * online/offline + SSR-гард за узким интерфейсом. Все потребители (бейдж
 * свежести, дренаж outbox, будущий офлайн-старт) подписываются ЧЕРЕЗ него и НЕ
 * плодят второй `window 'online'`-листенер (урок H4.3). `target` инъектируем →
 * чистая юнит-проверка в node без jsdom; по умолчанию = window, на сервере
 * undefined → безопасный no-op.
 */
export type OnlineHandlers = {
  onOnline: () => void;
  onOffline: () => void;
};

type OnlineEventTarget = Pick<
  typeof window,
  "addEventListener" | "removeEventListener"
>;

export function subscribeOnline(
  handlers: OnlineHandlers,
  target: OnlineEventTarget | undefined = typeof window !== "undefined"
    ? window
    : undefined,
): () => void {
  if (!target) return () => {};
  target.addEventListener("online", handlers.onOnline);
  target.addEventListener("offline", handlers.onOffline);
  return () => {
    target.removeEventListener("online", handlers.onOnline);
    target.removeEventListener("offline", handlers.onOffline);
  };
}
