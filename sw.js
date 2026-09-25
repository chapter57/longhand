// Retires the offline worker Longhand used before the writing app moved into
// /write/. Copies installed back then still check this address for updates;
// this version clears their old cached app, removes itself, and reloads open
// pages so they get the website instead. The writing app has its own worker
// in /write/sw.js. Your writing lives elsewhere and is not touched.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => /^longhand-\d+$/.test(k)).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const pages = await self.clients.matchAll({ type: "window" });
    pages.forEach((page) => page.navigate(page.url));
  })());
});
