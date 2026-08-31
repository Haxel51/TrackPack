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
    const notifTitle = title || 'Fleet Alert 🚚';
    const notifBody = body || 'New real-time fleet update received';
    
    const notificationOptions = {
      body: notifBody,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || {},
      actions: [
        {
          action: 'view',
          title: 'View Trip'
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
