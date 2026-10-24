// Waybilla Universal Offline & Push Service Worker
// Enables 100% offline access when opened from Google Chrome / Safari / Home Screen
// Caches app shell, scripts, styles, images, and coordinates offline data sync

const CACHE_NAME = 'waybilla-offline-cache-v40';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png'
];

// Optional Firebase Messaging Compat scripts for native Web Push
try {
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyCF5BcPjc0tPqK3N-F0-xL-puN6a643z8k",
    authDomain: "studio-4052460451-ae5db.firebaseapp.com",
    projectId: "studio-4052460451-ae5db",
    storageBucket: "studio-4052460451-ae5db.firebasestorage.app",
    messagingSenderId: "615516479021",
    appId: "1:615516479021:web:9d6a403297f382654de2a4"
  });

  const messaging = firebase.messaging();
  if (messaging) {
    messaging.onBackgroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      const notifTitle = title || 'Waybilla Update 🚚📦';
      const notifBody = body || 'New status update received.';
      self.registration.showNotification(notifTitle, {
        body: notifBody,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: payload.data || {},
        vibrate: [200, 100, 200],
        tag: 'waybilla-push-' + (payload.data?.tracking_code || Date.now())
      });
    });
  }
} catch (swErr) {
  console.log('[SW] Firebase messaging compat notice (offline or unreached):', swErr);
}

// 1. Install Event — Skip waiting immediately to activate new code
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching partial notice:', err);
      });
    })
  );
});

// 2. Activate Event — Clean all previous caches and take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('[SW] Purging stale cache:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Message Event for manual skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch Event — Network-First with Cache Fallback
// Always attempts network fetch first so users never get locked into stale cached code.
// Falls back gracefully to cache when the device is offline in motor parks.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Skip API routes, WebSockets, chrome extensions
  if (url.pathname.startsWith('/api') || url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // Network-First strategy
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkRes;
      })
      .catch(async () => {
        // Device is offline: fall back to cache
        const cachedRes = await caches.match(event.request);
        if (cachedRes) return cachedRes;

        // For navigation requests while offline, fallback to cached index.html or root
        if (event.request.mode === 'navigate') {
          const fallbackIndex = await caches.match('/index.html');
          if (fallbackIndex) return fallbackIndex;
          const fallbackRoot = await caches.match('/');
          if (fallbackRoot) return fallbackRoot;
        }

        return new Response('Offline - No connection and asset not cached', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// 5. Background Sync Listener for queued offline waybills
self.addEventListener('sync', (event) => {
  if (event.tag === 'waybilla-sync' || event.tag === 'sync-waybills') {
    console.log('[SW] Background sync triggered:', event.tag);
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'WAYBILLA_TRIGGER_OFFLINE_SYNC' });
        });
      })
    );
  }
});

// 6. Native Push Events
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

  const title = data.title || 'Waybilla Alert 📦';
  const options = {
    body: data.body || 'Your waybill status has been updated.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    tag: data.tag || 'wb-' + Date.now()
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 7. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/';

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
