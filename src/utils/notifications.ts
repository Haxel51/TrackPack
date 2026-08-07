/**
 * Native OS Notification Dispatcher for Waybilla
 * Dispatches notifications directly via ServiceWorkerRegistration.showNotification()
 * to guarantee delivery on Android, iOS Web, and Desktop browsers.
 */

export const triggerOSNotification = async (title: string, options: {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
} = {}) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported in this browser environment.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted:', Notification.permission);
    return false;
  }

  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    renotify: true,
    data: { url: '/customer' },
    ...options
  };

  // 1. Try Service Worker Registration (Required on Android Chrome & PWAs)
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, defaultOptions);
        console.log('[Native Notification Dispatched via ServiceWorker]:', title);
        return true;
      }
    }
  } catch (err) {
    console.warn('SW registration showNotification failed:', err);
  }

  // 2. Fallback to messaging controller
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        options: defaultOptions
      });
      console.log('[Notification Message Posted to Controller]:', title);
      return true;
    }
  } catch (err) {
    console.warn('SW postMessage failed:', err);
  }

  // 3. Fallback for Desktop classic browsers
  try {
    new Notification(title, defaultOptions);
    console.log('[Direct Notification Dispatched]:', title);
    return true;
  } catch (err) {
    console.error('Direct Notification constructor failed:', err);
    return false;
  }
};
