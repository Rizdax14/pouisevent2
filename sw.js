// VERSION: bump this string to force cache clear on all clients
const CACHE_VERSION = 'pouis-v2-' + '20261008095631';
const ASSETS = [
  '/',
  '/index.html',
  '/utopia-events.js',
  '/foot-logic.js',
  '/foot-theme.js',
  '/insta-logic.js',
  '/foot-display.js',
  '/foot-ui.js',
  '/foot-room.js',
  '/foot.js',
  '/manifest.json',
];

// Install: cache assets and immediately activate
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // Don't wait for old SW to die
  );
});

// Activate: delete ALL old caches, then take control immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // Take control of all open tabs
      .then(() => {
        // Tell all clients to reload so they get fresh content
        return self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.navigate(client.url));
        });
      })
  );
});

// Fetch: network first for JS/HTML (always fresh), cache fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Always go to network for Supabase
  if (url.includes('supabase.co') || url.includes('unpkg.com') || url.includes('jsdelivr')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Generated visuals depend on live data: never cache them (cache-first would serve a stale render)
  if (url.includes('/api/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Network first for main app files — always get latest
  if (url.includes('utopia-events.js') || url.includes('foot-logic.js') || url.includes('insta-logic.js') || url.includes('foot-theme.js') || url.includes('foot-display.js') || url.includes('foot-ui.js') || url.includes('foot-room.js') || url.includes('foot.js') || url.includes('index.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache first for images/icons
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && e.request.method === 'GET') {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
