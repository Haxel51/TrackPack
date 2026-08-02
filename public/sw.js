const CACHE_NAME = 'trackpack-cache-v6';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo_final_v4.jpg',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache).catch(function(err) {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  // Skip non-GET requests or API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  const url = new URL(event.request.url);

  // Network-first for HTML, JS, CSS, and main bundle assets so deployments are always up to date
  if (
    event.request.mode === 'navigate' ||
    event.request.headers.get('accept')?.includes('text/html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      fetch(event.request)
        .then(function(networkResponse) {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(function() {
          return caches.match(event.request).then(function(response) {
            if (response) return response;
            // Only return index.html for page navigation, never for script/style assets!
            if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
              return caches.match('/index.html');
            }
            return new Response('Asset unavailable offline', { status: 404, statusText: 'Not Found' });
          });
        })
    );
    return;
  }

  // Cache-first for images and static media with network fallback & offline logo safety
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(function(response) {
      if (response) {
        return response;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(function() {
        return caches.match('/logo_final_v4.jpg');
      });
    })
  );
});

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event received with no data');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || "TrackPack Shipment Update";
    const options = {
      body: payload.body || "Your shipment status has changed.",
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/icon-192.png",
      data: {
        url: payload.url || '/'
      },
      vibrate: [200, 100, 200],
      tag: payload.tag || 'shipment-update'
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (err) {
    console.error("Error displaying background notification:", err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
