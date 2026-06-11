/* ------------------------------------------------------------------ */
/*  Tile Cache Service Worker — cache-first for map tiles             */
/* ------------------------------------------------------------------ */

const CACHE_NAME = 'tile-cache-v1';

/** Tile provider domains we want to cache aggressively. */
const TILE_DOMAINS = [
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
  'tile.opentopomap.org',
  'server.arcgisonline.com',
];

/** @param {string} url @returns {boolean} */
function isTileRequest(url) {
  try {
    const { hostname } = new URL(url);
    return TILE_DOMAINS.some((domain) => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

/* ── Install ──────────────────────────────────────────────────────── */

self.addEventListener('install', () => {
  // Activate immediately — don't wait for old SW to close
  self.skipWaiting();
});

/* ── Activate ─────────────────────────────────────────────────────── */

self.addEventListener('activate', (event) => {
  // Purge any previously cached data under a different cache name
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)));
      // Take control of all open clients immediately
      await self.clients.claim();
    })(),
  );
});

/* ── Fetch ────────────────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  // Only intercept tile requests from known providers
  if (!isTileRequest(event.request.url)) return;

  event.respondWith(cacheFirst(event.request));
});

/**
 * Cache-first strategy: serve from cache if available, otherwise fetch
 * from the network and store a copy in the cache for future requests.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  // Not in cache — fetch from network
  const response = await fetch(request);

  // Cache a clone of the response (response body is a single-use stream)
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }

  return response;
}
