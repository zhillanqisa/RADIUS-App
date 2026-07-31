/* RADIUS service worker -- installability + offline shell fallback.
   Strategi NETWORK-FIRST untuk semua (update selalu masuk, hindari bug
   stale-cache). Cache dipakai HANYA sebagai cadangan offline aset shell. */
"use strict";

const CACHE = "radius-shell-v7";

// Aset shell yang aman di-cache (vendor lokal jarang berubah).
// CATATAN: css/js kita memakai ?v=<versi> yang SAMA dengan index.html.
// FastAPI StaticFiles tidak mengirim Cache-Control, jadi browser memakai
// heuristic freshness dan bisa menyajikan aset basi setelah deploy. Query
// versi adalah satu-satunya cache-buster yang kita punya tanpa menyentuh app/.
// Naikkan versi di index.html DAN di sini bersamaan.
const SHELL = [
  "/",
  "/index.html",
  "/css/tokens.css?v=7",
  "/css/base.css?v=7",
  "/css/components.css?v=7",
  "/css/app.css?v=7",
  "/js/i18n.js?v=7",
  "/js/store.js?v=7",
  "/js/format.js?v=7",
  "/js/persona.js?v=7",
  "/js/cost.js?v=7",
  "/js/app.js?v=7",
  "/vendor/maplibre/maplibre-gl.css",
  "/vendor/maplibre/maplibre-gl.js",
  "/vendor/fonts/outfit-variable.woff2",
  "/vendor/icons/sprite.svg",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // JANGAN cache API atau tile peta (selalu live).
  if (url.pathname.startsWith("/api/") || url.hostname.includes("openfreemap")) {
    return; // biarkan default (network)
  }

  // Network-first: coba jaringan, jatuh ke cache saat offline.
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/index.html")))
  );
});
