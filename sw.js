const CACHE_NAME = "iptv-library-cache-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon.svg"
];

function isAppAsset(url) {
  return url.origin === self.location.origin && ASSETS.includes(url.pathname === "/" ? "./" : `.${url.pathname}`);
}

function isLikelyMediaRequest(url) {
  return /\.(m3u8|mpd|ts|m4s|mp4|mp3|aac|webm)(\?|$)/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (isLikelyMediaRequest(requestUrl) || requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAppAsset(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return networkResponse;
          })
          .catch(() => caches.match("./index.html"));
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)).catch(() => caches.match("./index.html"))
  );
});
