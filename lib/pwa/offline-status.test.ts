import { describe, expect, it, vi } from "vitest";

import {
  formatOfflineSince,
  LAST_ONLINE_KEY,
  subscribeOnline,
} from "@/lib/pwa/offline-status";

describe("formatOfflineSince", () => {
  // Опорное «сейчас»: 14 июн 2026, 08:20 локального времени.
  const now = new Date(2026, 5, 14, 8, 20, 0).getTime();

  it("ts null → честная подпись без выдуманного времени (R-10/R-37)", () => {
    expect(formatOfflineSince(null, now)).toBe("сохранённые данные");
  });

  it("NaN/битый ts трактуется как отсутствие времени", () => {
    expect(formatOfflineSince(Number.NaN, now)).toBe("сохранённые данные");
  });

  it("тот же день → «данные на сегодня HH:MM»", () => {
    const ts = new Date(2026, 5, 14, 7, 5, 0).getTime();
    expect(formatOfflineSince(ts, now)).toBe("данные на сегодня 07:05");
  });

  it("вчера → «данные на вчера HH:MM»", () => {
    const ts = new Date(2026, 5, 13, 21, 30, 0).getTime();
    expect(formatOfflineSince(ts, now)).toBe("данные на вчера 21:30");
  });

  it("старше вчера → «данные на D mon» без времени", () => {
    const ts = new Date(2026, 5, 11, 10, 0, 0).getTime();
    expect(formatOfflineSince(ts, now)).toBe("данные на 11 июн.");
  });

  it("ключ localStorage стабилен", () => {
    expect(LAST_ONLINE_KEY).toBe("fit:last-online");
  });
});

describe("subscribeOnline", () => {
  it("вешает online/offline-листенеры на target", () => {
    const target = new EventTarget();
    const add = vi.spyOn(target, "addEventListener");
    const onOnline = vi.fn();
    const onOffline = vi.fn();

    subscribeOnline({ onOnline, onOffline }, target);

    expect(add).toHaveBeenCalledWith("online", onOnline);
    expect(add).toHaveBeenCalledWith("offline", onOffline);
  });

  it("реально дёргает хендлеры по событиям, и перестаёт после unsubscribe", () => {
    const target = new EventTarget();
    const onOnline = vi.fn();
    const onOffline = vi.fn();

    const unsubscribe = subscribeOnline({ onOnline, onOffline }, target);

    target.dispatchEvent(new Event("offline"));
    target.dispatchEvent(new Event("online"));
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);

    unsubscribe();
    target.dispatchEvent(new Event("offline"));
    target.dispatchEvent(new Event("online"));
    // После отписки счётчики не растут (ровно один носитель, листенер снят).
    expect(onOffline).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
  });

  it("target undefined (SSR) → безопасный no-op unsubscribe", () => {
    const unsubscribe = subscribeOnline(
      { onOnline: vi.fn(), onOffline: vi.fn() },
      undefined,
    );
    expect(() => unsubscribe()).not.toThrow();
  });
});
