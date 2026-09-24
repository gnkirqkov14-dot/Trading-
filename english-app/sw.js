// Service worker: приложението работи и без интернет.
// При промяна на файловете увеличи VERSION.
const VERSION = 'v2';
const CACHE = `english-a1-${VERSION}`;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './js/app.js', './js/util.js', './js/store.js', './js/srs.js', './js/speech.js', './js/sfx.js',
  './js/confetti.js', './js/exercises.js', './js/steps.js', './js/lesson.js', './js/games.js', './js/stats.js',
  './js/ui.js', './js/content/index.js', './js/content/lessons-1.js', './js/content/lessons-2.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Първо от кеша (бързо и офлайн), а във фонов режим обновяваме кеша от мрежата.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const fresh = fetch(req)
        .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || fresh;
    })
  );
});
