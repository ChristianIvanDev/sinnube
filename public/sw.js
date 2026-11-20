// Service worker de Sinnube: permite usar la app sin conexión.
// Estrategia: la página se pide primero a la red (para recibir versiones nuevas) y, si no hay
// conexión, se sirve la última guardada. El resto (scripts con hash, fuentes) sale de la caché.
const CACHE = 'sinnube-v1';
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE.pathname, `${SCOPE.pathname}favicon.svg`])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const cacheable = (url) =>
  url.origin === SCOPE.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!cacheable(url)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SCOPE.pathname, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE.pathname)),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
