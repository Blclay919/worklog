/* Study Log Service Worker */
const CACHE_VERSION = 'study-log-v1';

const PRECACHE_URLS = [
  './index.html',
  './pages/subject.html',
  './pages/log.html',
  './pages/plan.html',
  './pages/statistics.html',
  './pages/calendar.html',
  './css/base.css',
  './css/dashboard.css',
  './css/subject.css',
  './css/log.css',
  './css/plan.css',
  './css/statistics.css',
  './css/calendar.css',
  './js/utils.js',
  './js/subjects.js',
  './js/storage.js',
  './js/app.js',
  './js/upload.js',
  './js/plan.js',
  './js/log.js',
  './js/statistics.js',
  './js/calendar.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_VERSION;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then(function (cache) {
          cache.put(request, copy);
        }).catch(function () {});
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) {
            cache.put(request, copy);
          }).catch(function () {});
        }
        return response;
      });
    })
  );
});
