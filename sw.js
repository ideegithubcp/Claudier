const CACHE = 'swiperight-v15';
const ASSETS = [
  '/', '/index.html', '/app.css', '/manifest.json',
  '/cards.json', '/vendors.json',
  '/icon-192.png', '/icon-512.png',
  '/js/app.js', '/js/config.js', '/js/storage.js', '/js/state.js',
  '/js/cards.js', '/js/data.js', '/js/search.js', '/js/places.js',
  '/js/wallet.js', '/js/overrides.js', '/js/ui.js', '/js/stats.js',
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — purge old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML + JSON (always fresh on deploy), cache-first for static assets
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // JS files are network-first too so deploys take effect without SW cache bumps
  const isNetworkFirst = url.pathname.endsWith('.json') || url.pathname.endsWith('.js') || url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('.css');

  if (isNetworkFirst) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-first for images and other static assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && res.status === 200 && url.origin === self.location.origin) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => {
          if (e.request.mode === 'navigate') return caches.match('/index.html');
        });
      })
    );
  }
});

// Message handler for manual cache refresh
self.addEventListener('message', e => {
  if (e.data === 'REFRESH_DATA') {
    caches.open(CACHE).then(cache => {
      Promise.all([
        fetch('/cards.json').then(r => r.ok ? cache.put('/cards.json', r) : null),
        fetch('/vendors.json').then(r => r.ok ? cache.put('/vendors.json', r) : null)
      ]).then(() => {
        self.clients.matchAll().then(clients =>
          clients.forEach(c => c.postMessage({ type: 'DATA_REFRESHED' }))
        );
      });
    });
  }
});
