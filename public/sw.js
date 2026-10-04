/**
 * Service worker for the BYU Campus Calendar PWA.
 *
 * Caching strategy, chosen per resource type rather than one blanket rule:
 *
 *   - Navigations  → network-first, falling back to the cached shell. A student opening the app on
 *                    campus wifi gets fresh markup; one on the shuttle with no signal still gets
 *                    the app instead of the browser's offline page.
 *   - Hashed assets→ cache-first. Vite fingerprints JS/CSS filenames, so a cached one can never be
 *                    stale: a new build produces a new URL.
 *   - Event images → cache-first with a capped image cache. These are large, immutable, and come
 *                    from BYU's CDN; without a cap the cache would grow without bound.
 *   - /feed.ics    → never cached. It is a calendar subscription; a stale copy is worse than none.
 *
 * The cache name carries a version. Bumping it drops every old cache in `activate`, which is the
 * simplest correct invalidation for an app whose data ships inside the JS bundle.
 */

const VERSION = 'v3';
const SHELL_CACHE = `byu-shell-${VERSION}`;
const ASSET_CACHE = `byu-assets-${VERSION}`;
const IMAGE_CACHE = `byu-images-${VERSION}`;
const MAX_IMAGES = 120;

const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A single missing shell URL should not abort the whole install, so each is added
      // individually and failures are tolerated.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('byu-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Keeps a cache under a size cap by evicting oldest-inserted entries first. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // The calendar subscription must always hit the network — a cached .ics would silently stop
  // updating a student's subscribed calendar.
  if (url.pathname === '/feed.ics' || url.pathname.startsWith('/api/')) return;

  // Cross-origin: only event images from BYU's CDN are cached. Everything else (fonts, analytics)
  // passes straight through.
  if (url.origin !== self.location.origin) {
    if (request.destination === 'image') {
      event.respondWith(
        caches.open(IMAGE_CACHE).then(async (cache) => {
          const hit = await cache.match(request);
          if (hit) return hit;
          try {
            const response = await fetch(request);
            // Opaque responses (no CORS) are still worth caching for images; they render fine.
            if (response.ok || response.type === 'opaque') {
              await cache.put(request, response.clone());
              trimCache(IMAGE_CACHE, MAX_IMAGES);
            }
            return response;
          } catch {
            return Response.error();
          }
        })
      );
    }
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(async () => (await caches.match('/')) ?? Response.error())
    );
    return;
  }

  // Fingerprinted build output: safe to serve from cache indefinitely.
  if (url.pathname.startsWith('/assets/') || request.destination === 'style' || request.destination === 'script') {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Same-origin images (icons) and anything else: cache-first with a network fallback.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && request.destination === 'image') {
            caches.open(IMAGE_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
    )
  );
});
