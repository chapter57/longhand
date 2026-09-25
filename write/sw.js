// Keeps the Longhand writing app working offline. Bump VERSION whenever any app
// file changes, so installed copies fetch the new files on their next launch.
// Caches are shared across the whole site, so this one only ever touches
// caches named "longhand-write-…" (plus the old "longhand-N" ones from before
// the app moved into /write/).
const VERSION = "longhand-write-6";
const FILES = [
  "./",
  "index.html",
  "app.js",
  "rtf.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "../fonts/Literata-normal-400.woff2",
  "../fonts/Literata-normal-600.woff2",
  "../fonts/Literata-italic-400.woff2",
  "../fonts/Literata-italic-600.woff2",
  "../fonts/IBMPlexMono-normal-400.woff2",
  "../fonts/IBMPlexMono-normal-500.woff2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => k !== VERSION && (k.startsWith("longhand-write-") || /^longhand-\d+$/.test(k)))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("./").then((home) => home || fetch(req));
      return fetch(req);
    })
  );
});
