/// <reference lib="webworker" />

const CACHE_VERSION = "v6";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const PRECACHE_URLS = ["/offline.html"];

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|ico|svg|png|jpg|gif|webp)$/;
const NEXT_STATIC = /\/_next\/static\//;
const API_ROUTES = /\/(api|_next\/data)\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // API routes — network only, never cache
  if (API_ROUTES.test(url.pathname)) return;

  // Next.js static assets (content-hashed) — cache first
  if (NEXT_STATIC.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Static files — cache first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // HTML/RSC-контент может быть персональным. Его нельзя класть в Cache API:
  // ключ не учитывает cookie, поэтому на общем устройстве это раскрыло бы
  // данные предыдущего аккаунта. Офлайн показывает только нейтральную страницу.
  if (request.mode === "navigate") {
    event.respondWith(networkOnlyNavigation(request));
    return;
  }

  // Динамические GET/RSC запросы тоже network-only. Кэшируем лишь immutable
  // static assets выше.
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkOnlyNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offlinePage = await caches.match("/offline.html");
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// При logout и смене сессии очищаем runtime-кэши предыдущих версий. static
// assets остаются: они не содержат пользовательских данных и нужны офлайн.
self.addEventListener("message", (event) => {
  if (event.data?.type !== "FITNESS_PURGE_RUNTIME_CACHE") return;
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("runtime-"))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
});

// --- Web Push: receive + click ----------------------------------------------

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Уведомление", body: event.data.text() };
    }
  }

  const title = payload.title || "Fitness AI";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: payload.tag || "fitness-ai",
    data: { url: payload.url || "/" },
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Если открыта вкладка — фокусируемся и навигируем туда.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* navigate может бросить на cross-origin — игнорим */
            }
          }
          return;
        }
      }
      // Иначе — открываем новую.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
