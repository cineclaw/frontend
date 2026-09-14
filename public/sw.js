const CACHE_NAME = 'cineclaw-v1.0.0';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/apple-touch-icon.png'
];

// Install: pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for dynamic & streaming, Cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER intercept streaming, torrents, poster proxy, or dynamic indexer APIs
  if (
    url.pathname.startsWith('/torrents') ||
    url.pathname.startsWith('/stream') ||
    url.pathname.startsWith('/torr') ||
    url.pathname.startsWith('/gst') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/search') ||
    url.pathname.startsWith('/poster') ||
    url.pathname.startsWith('/series') ||
    url.pathname.startsWith('/status') ||
    url.pathname.startsWith('/health') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. Navigation requests: Network-first with offline SPA fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match('/');
        })
    );
    return;
  }

  // 3. Static assets (JS, CSS, icons, images): Stale-while-revalidate / Cache-first
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png')
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Fetch update in background
          fetch(event.request)
            .then((res) => {
              if (res && res.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
