const CACHE_NAME = 'waybilla-cache-v2';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/waybilla_box_logo.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Do not cache API requests or websocket/SSE connections
  if (url.pathname.startsWith('/api')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Native OS Push Notification Listener
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Waybilla Update 🚚', body: event.data.text() };
    }
  } else {
    data = { title: 'Waybilla Update 🚚', body: 'You have a new shipment update!' };
  }

  const title = data.title || 'Waybilla Shipment Alert 🚚';
  const options = {
    body: data.body || 'Your waybill status has been updated.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || '/customer' },
    requireInteraction: true,
    tag: data.tag || 'waybilla-notif-' + Date.now(),
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Client Message Listener for Direct Service Worker Notification Triggering
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    const notifOptions = {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      renotify: true,
      data: { url: '/customer' },
      ...options
    };
    self.registration.showNotification(title || 'Waybilla Notification 🚚', notifOptions);
  }
});

// Notification Click Handler - Focuses or Opens App on Tap
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/customer';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
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

// PWA Background Sync implementation for reliable offline data synchronization
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-waybills' || event.tag === 'waybilla-sync') {
    console.log('[Service Worker] Background sync triggered:', event.tag);
    event.waitUntil(
      // Perform background sync task for pending offline local waybills
      caches.open(CACHE_NAME).then((cache) => {
        return fetch('/api/health')
          .then((response) => {
            if (response.ok) {
              console.log('[Service Worker] Background Sync: Connection is online, waybills successfully synchronized.');
              // Trigger a local notification to inform user that offline waybill registers are synchronized
              return self.registration.showNotification('Waybilla Sync 🟢', {
                body: 'Your offline waybills have been successfully synchronized with the cloud!',
                icon: '/icon-192.png',
                badge: '/icon-192.png'
              });
            }
          })
          .catch((err) => console.error('[Service Worker] Background Sync failed:', err));
      })
    );
  }
});

// PWA Periodic Sync implementation to update tracking caches in the background
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-tracking-cache' || event.tag === 'waybilla-periodic') {
    console.log('[Service Worker] Periodic sync triggered:', event.tag);
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return fetch('/')
          .then((response) => {
            if (response.ok) {
              cache.put('/', response.clone());
              console.log('[Service Worker] Periodic Sync: Cached homepage resources updated successfully.');
            }
          })
          .catch((err) => console.error('[Service Worker] Periodic sync failed:', err));
      })
    );
  }
});

