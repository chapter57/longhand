// The Longhand writing app has been retired. Installed copies still check this
// address for updates; this version clears the app's offline files, removes
// itself, and reloads open pages so they show the retirement page, where people
// can download anything they wrote. Their writing (in IndexedDB) is not touched.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => /^longhand-write-/.test(k)).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const pages = await self.clients.matchAll({ type: "window" });
    pages.forEach((page) => page.navigate(page.url));
  })());
});
