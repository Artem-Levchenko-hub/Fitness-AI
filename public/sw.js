/// <reference lib="webworker" />

const CACHE_VERSION = "v4";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

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
              (key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE,
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

  // Navigation (HTML pages) — network-FIRST с офлайн-фоллбэком на последнюю
  // закэшированную версию страницы (офлайн-чтение, H15.2). Онлайн сеть
  // выигрывает всегда → свежий RSC-рендер, никакого stale-shell. В кэш
  // кладём ТОЛЬКО чистый 200 (НЕ редиректы): закэшированный 307→/login
  // пережил бы валидный логин (известный баг iOS PWA).
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Everything else — stale while revalidate
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
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

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    // Кэшируем для офлайн-чтения ТОЛЬКО чистый 200 — не редиректы (307→/login
    // не должен пережить логин). Онлайн всё равно отдаём сетевой ответ ниже,
    // так что свежесть не страдает.
    if (response.status === 200 && !response.redirected) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Офлайн → последняя закэшированная версия этой страницы, иначе offline.html.
    const cached = await caches.match(request);
    if (cached) return cached;

    const offlinePage = await caches.match("/offline.html");
    if (offlinePage) return offlinePage;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

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
