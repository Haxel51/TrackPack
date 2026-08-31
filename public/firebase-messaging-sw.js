importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize Firebase App in ServiceWorker context
firebase.initializeApp({
  apiKey: "AIzaSyCF5BcPjc0tPqK3N-F0-xL-puN6a643z8k",
  authDomain: "studio-4052460451-ae5db.firebaseapp.com",
  projectId: "studio-4052460451-ae5db",
  storageBucket: "studio-4052460451-ae5db.firebasestorage.app",
  messagingSenderId: "615516479021",
  appId: "1:615516479021:web:9d6a403297f382654de2a4"
});

let messaging;
try {
  messaging = firebase.messaging();
} catch (e) {
  console.log('[SW] Firebase messaging init:', e);
}

// Handle background notifications when app is closed or in background
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Received background message:', payload);
    const { title, body } = payload.notification || {};
    const notifTitle = title || 'Waybilla & Fleet Alert 🚚📦';
    const notifBody = body || 'New real-time update received.';
    
    const notificationOptions = {
      body: notifBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || {},
      vibrate: [200, 100, 200],
      tag: 'waybilla-push-' + (payload.data?.tracking_code || payload.data?.tripId || Date.now()),
      renotify: true,
      actions: [
        {
          action: 'view',
          title: 'Open App'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    };

    self.registration.showNotification(notifTitle, notificationOptions);
  });
}

// Fallback listener for standard Web Push events
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    console.log('[SW] Raw Push Event Received:', payload);
    
    const title = payload.notification?.title || payload.title || 'Waybilla Shipment Alert 📦';
    const body = payload.notification?.body || payload.body || 'You have a new shipment notification.';
    
    const options = {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || payload,
      vibrate: [200, 100, 200],
      tag: 'waybilla-raw-push-' + Date.now(),
      renotify: true
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('[SW] Push payload parse error (non-JSON):', e);
  }
});

// Handle notification tap / click in phone notification bar
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }

  const tripId = event.notification.data?.tripId || event.notification.data?.trip_id;
  const eventType = event.notification.data?.eventType || '';
  const url = tripId ? `/?tripId=${tripId}&eventType=${eventType}` : '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
