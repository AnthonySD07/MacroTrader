const CACHE = "macro-trader-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // never cache API or TradingView calls
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));



self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil((async () => {
    const target = new URL(
      event.notification.data?.url || "./index.html",
      self.registration.scope
    ).href;

    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.focus();
        await client.navigate(target);
        return;
      }
    }

    await self.clients.openWindow(target);
  })());
});

  });
