/* ───────────────────────────────────────────────────────────────
   KILL-SWITCH service worker.
   The site no longer uses a service worker. A previous version
   (cache "treevision-field-v4") could get stuck serving a stale
   app shell, causing a blank screen for returning visitors.
   This replacement deletes all caches, unregisters itself, and
   reloads any open pages so everyone recovers automatically.
─────────────────────────────────────────────────────────────── */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      // 1) delete every cache this origin has
      const keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      // 2) take control, then unregister self
      await self.clients.claim();
      await self.registration.unregister();
      // 3) force any open tabs to reload fresh from the network
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(function (client) {
        try { client.navigate(client.url); } catch (e) { /* ignore */ }
      });
    } catch (e) { /* never block activation */ }
  })());
});

/* Pass all requests straight to the network — no caching. */
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
