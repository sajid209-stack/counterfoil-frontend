// F10 app-shell service worker. Shell only: hashed build assets and fonts are
// cached first-hit so the app opens instantly; navigations stay network-first
// (offline DATA is deferred and out of scope — this is not offline mode).
const SHELL_CACHE = "counterfoil-shell-v4";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets + icons: cache-first.
  const isShellAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname === "/manifest.webmanifest";
  if (isShellAsset) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network-first with a cached fallback of the same page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
  }
});
