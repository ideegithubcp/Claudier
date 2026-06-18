const CACHE = 'swiperight-v5';
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/cards.json', '/vendors.json',
  '/icon-192.png', '/icon-512.png'
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

// Fetch — cache-first for app assets, network-first for data JSON
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isData = url.pathname.endsWith('.json');

  if (isData) {
    // Network-first for JSON data files (allows refresh to work)
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
    // Cache-first for app shell
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
