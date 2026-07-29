/* Service worker: makes the app installable and work offline.
   Strategy: the page itself is fetched fresh from the network when online (so your
   edits show up right away), and falls back to the saved copy only when offline.
   Icons/manifest are served from cache for speed. */
var CACHE = "us-app-v10";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  // Supabase (photos/data) and the library CDN go straight to the network.
  if (url.origin !== self.location.origin) return;

  var isPage = e.request.mode === "navigate" || url.pathname === "/" || url.pathname.slice(-1) === "/" || url.pathname.indexOf("index.html") !== -1;
  if (isPage) {
    // Network-first: always try to get the latest page, fall back to cache when offline.
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return res;
      }).catch(function () {
        return caches.match(e.request).then(function (c) { return c || caches.match("./index.html"); });
      })
    );
    return;
  }
  // Everything else (icons, manifest): cache-first for speed.
  e.respondWith(caches.match(e.request).then(function (c) { return c || fetch(e.request); }));
});
