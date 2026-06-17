import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

/**
 * Регрессионный страж PWA-офлайн-фундамента (H15.1).
 *
 * `public/sw.js` — рукописный service worker (путь B: build = Turbopack, а
 * `@serwist/next` требует webpack — несовместимо, см. §5★ H15.1). Он несёт три
 * инварианта, на которых держится вся кампания само-улучшения, деплоящая почти
 * каждый тик:
 *
 *  1. **Офлайн-fallback (столп 4).** Любая навигация без сети → закэшированная
 *     `/offline.html`, а не браузерный dino. Прекэш `/offline.html` на install.
 *  2. **Свежий билд + офлайн-чтение (network-first, H15.2).** Навигации идут
 *     network-FIRST: онлайн сеть выигрывает всегда → свежий RSC-рендер, никакого
 *     stale-shell. Офлайн → последняя закэшированная версия страницы (чтение без
 *     сети, столп 4), иначе `/offline.html`. В кэш кладём ТОЛЬКО чистый `200`
 *     (не редиректы): закэшированный 307→/login пережил бы валидный логин (баг
 *     iOS PWA) — поэтому редиректы в кэш не попадают никогда.
 *  3. **Стратегия обновления SW.** `skipWaiting` + `clients.claim` + чистка
 *     старых версионных кэшей на activate — новый SW берёт управление сразу,
 *     осиротевшие кэши прошлых версий сносятся.
 *
 * Тест ГОНЯЕТ САМ `public/sw.js` (не зеркало-модуль — иначе два носителя одного
 * знания разойдутся, урок H4.3) в песочнице с мок-`self`/`caches`/`fetch`.
 */

class FakeResponse {
  body: string;
  status: number;
  ok: boolean;
  redirected: boolean;
  headers: Record<string, string>;
  marker?: string;
  constructor(
    body: string,
    init: {
      status?: number;
      headers?: Record<string, string>;
      marker?: string;
      redirected?: boolean;
    } = {},
  ) {
    this.body = body;
    this.status = init.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.redirected = init.redirected ?? false;
    this.headers = init.headers ?? {};
    this.marker = init.marker;
  }
  clone() {
    return new FakeResponse(this.body, {
      status: this.status,
      headers: this.headers,
      marker: this.marker,
      redirected: this.redirected,
    });
  }
}

type Req = string | { method?: string; url: string; mode?: string };
const keyOf = (req: Req): string => (typeof req === "string" ? req : req.url);

type FetchImpl = (req: Req) => Promise<FakeResponse>;

class FakeCache {
  private store = new Map<string, FakeResponse>();
  constructor(private fetchImpl: FetchImpl) {}
  async addAll(urls: string[]) {
    for (const url of urls) {
      const res = await this.fetchImpl(url);
      this.store.set(url, res);
    }
  }
  async put(req: Req, res: FakeResponse) {
    this.store.set(keyOf(req), res);
  }
  async match(req: Req) {
    return this.store.get(keyOf(req));
  }
  has(req: Req) {
    return this.store.has(keyOf(req));
  }
}

class FakeCacheStorage {
  caches = new Map<string, FakeCache>();
  constructor(private fetchImpl: FetchImpl) {}
  async open(name: string) {
    let c = this.caches.get(name);
    if (!c) {
      c = new FakeCache(this.fetchImpl);
      this.caches.set(name, c);
    }
    return c;
  }
  async match(req: Req) {
    for (const c of this.caches.values()) {
      const hit = await c.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
  async keys() {
    return [...this.caches.keys()];
  }
  async delete(name: string) {
    return this.caches.delete(name);
  }
}

interface SwEvent {
  request: Req;
  responded?: Promise<FakeResponse | undefined>;
  respondWith(p: Promise<FakeResponse | undefined>): void;
  waitUntil(p: Promise<unknown>): void;
}

function makeEvent(request: Req): SwEvent {
  const waits: Promise<unknown>[] = [];
  const evt: SwEvent = {
    request,
    respondWith(p) {
      evt.responded = p;
    },
    waitUntil(p) {
      waits.push(p);
    },
  };
  return evt;
}

const SW_SOURCE = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");

/** Загружает реальный sw.js в песочницу, возвращает captured-листенеры + моки. */
function loadSw(fetchImpl: FetchImpl) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const skipWaiting = vi.fn(() => Promise.resolve());
  const claim = vi.fn(() => Promise.resolve());
  const self = {
    location: { origin: "https://app.lead-generator.ru" },
    addEventListener: (type: string, fn: (e: unknown) => void) => {
      listeners[type] = fn;
    },
    skipWaiting,
    clients: {
      claim,
      matchAll: async () => [],
      openWindow: async () => undefined,
    },
    registration: { showNotification: vi.fn() },
  };
  const caches = new FakeCacheStorage(fetchImpl);
  new Function("self", "caches", "fetch", "Response", SW_SOURCE)(
    self,
    caches,
    fetchImpl,
    FakeResponse,
  );
  return { listeners, caches, skipWaiting, claim };
}

const OFFLINE_BODY = "OFFLINE_PAGE_MARKER";
const offlineFetch: FetchImpl = (req) =>
  keyOf(req) === "/offline.html"
    ? Promise.resolve(new FakeResponse(OFFLINE_BODY, { marker: "offline" }))
    : Promise.resolve(new FakeResponse("", { status: 404 }));

describe("public/sw.js — PWA офлайн-фундамент (H15.1)", () => {
  it("install: прекэширует /offline.html и зовёт skipWaiting (инвариант 1+3)", async () => {
    const { listeners, caches, skipWaiting } = loadSw(offlineFetch);
    const evt = makeEvent("/install");
    listeners.install(evt);
    // дать install-цепочке (addAll→skipWaiting) завершиться
    await new Promise((r) => setTimeout(r, 0));
    const offline = await caches.match("/offline.html");
    expect(offline?.body).toBe(OFFLINE_BODY);
    expect(skipWaiting).toHaveBeenCalled();
  });

  it("activate: сносит старые версионные кэши, оставляет текущие, зовёт clients.claim (инвариант 3)", async () => {
    const { listeners, caches, claim } = loadSw(offlineFetch);
    // версионные кэши прошлого деплоя + текущие (имена держит сам sw.js)
    await caches.open("static-v1");
    await caches.open("runtime-v1");
    await caches.open("static-v4");
    await caches.open("runtime-v4");
    const evt = makeEvent("/activate");
    listeners.activate(evt);
    await new Promise((r) => setTimeout(r, 0));
    const remaining = await caches.keys();
    expect(remaining).not.toContain("static-v1");
    expect(remaining).not.toContain("runtime-v1");
    expect(remaining).toContain("static-v4");
    expect(remaining).toContain("runtime-v4");
    expect(claim).toHaveBeenCalled();
  });

  it("навигация офлайн → отдаёт /offline.html, не пустой/dino (инвариант 1, столп 4)", async () => {
    // сеть отдаёт только /offline.html (precache), любой роут — reject (офлайн)
    const env = loadSw((req) =>
      keyOf(req) === "/offline.html"
        ? Promise.resolve(new FakeResponse(OFFLINE_BODY, { marker: "offline" }))
        : Promise.reject(new Error("offline")),
    );
    env.listeners.install(makeEvent("/install"));
    await new Promise((r) => setTimeout(r, 0));
    const navEvt = makeEvent({
      method: "GET",
      url: "https://app.lead-generator.ru/dashboard",
      mode: "navigate",
    });
    env.listeners.fetch(navEvt);
    const res = await navEvt.responded;
    expect(res?.body).toBe(OFFLINE_BODY);
  });

  it("навигация онлайн (200) → отдаёт сетевой ответ и кэширует его для офлайна (инвариант 2, network-first)", async () => {
    const networkBody = "FRESH_NETWORK_RENDER";
    const env = loadSw((req) =>
      keyOf(req).endsWith("/dashboard")
        ? Promise.resolve(new FakeResponse(networkBody, { marker: "net" }))
        : Promise.resolve(new FakeResponse(OFFLINE_BODY)),
    );
    const navReq = {
      method: "GET",
      url: "https://app.lead-generator.ru/dashboard",
      mode: "navigate",
    };
    const navEvt = makeEvent(navReq);
    env.listeners.fetch(navEvt);
    const res = await navEvt.responded;
    // сеть выигрывает онлайн → свежий рендер, никакого stale-shell
    expect(res?.body).toBe(networkBody);
    // дать put-в-кэш в network-first завершиться
    await new Promise((r) => setTimeout(r, 0));
    // чистый 200 ОСЕЛ в кэше → доступен офлайн следующим заходом
    const cached = await env.caches.match(navReq);
    expect(cached?.body).toBe(networkBody);
  });

  it("навигация офлайн на ранее закэшированную страницу → отдаёт кэш, не offline.html (H15.2, офлайн-чтение)", async () => {
    const statsBody = "STATS_KPI_SNAPSHOT";
    let online = true;
    const env = loadSw((req) => {
      if (keyOf(req) === "/offline.html")
        return Promise.resolve(new FakeResponse(OFFLINE_BODY, { marker: "offline" }));
      if (!online) return Promise.reject(new Error("offline"));
      return keyOf(req).endsWith("/stats")
        ? Promise.resolve(new FakeResponse(statsBody, { marker: "net" }))
        : Promise.resolve(new FakeResponse("", { status: 404 }));
    });
    // прекэш offline.html на install
    env.listeners.install(makeEvent("/install"));
    await new Promise((r) => setTimeout(r, 0));
    const statsReq = {
      method: "GET",
      url: "https://app.lead-generator.ru/stats",
      mode: "navigate",
    };
    // 1) онлайн-заход прогревает кэш
    const onlineEvt = makeEvent(statsReq);
    env.listeners.fetch(onlineEvt);
    await onlineEvt.responded;
    await new Promise((r) => setTimeout(r, 0));
    // 2) уходим в офлайн, повторно заходим
    online = false;
    const offlineEvt = makeEvent(statsReq);
    env.listeners.fetch(offlineEvt);
    const res = await offlineEvt.responded;
    // видим последние данные, а не дино/offline.html
    expect(res?.body).toBe(statsBody);
  });

  it("навигация онлайн (307 редирект) → отдаёт ответ, но НЕ кэширует (анти-stale-login guard)", async () => {
    const env = loadSw((req) =>
      keyOf(req).endsWith("/dashboard")
        ? Promise.resolve(
            new FakeResponse("REDIRECT_TO_LOGIN", {
              status: 200,
              redirected: true,
            }),
          )
        : Promise.resolve(new FakeResponse(OFFLINE_BODY)),
    );
    const navReq = {
      method: "GET",
      url: "https://app.lead-generator.ru/dashboard",
      mode: "navigate",
    };
    const navEvt = makeEvent(navReq);
    env.listeners.fetch(navEvt);
    await navEvt.responded;
    await new Promise((r) => setTimeout(r, 0));
    // редирект (даже со статусом 200 + redirected) НЕ оседает в кэше →
    // не переживёт валидный логин (баг iOS PWA)
    const cached = await env.caches.match(navReq);
    expect(cached).toBeUndefined();
  });

  it("API-запрос → network-only, обработчик не перехватывает (никогда не кэшируется)", async () => {
    const env = loadSw(offlineFetch);
    const apiEvt = makeEvent({
      method: "GET",
      url: "https://app.lead-generator.ru/api/ai/trainer/insights",
      mode: "cors",
    });
    env.listeners.fetch(apiEvt);
    expect(apiEvt.responded).toBeUndefined();
  });
});
