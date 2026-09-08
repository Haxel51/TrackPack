/**
 * Native OS Notification Dispatcher for Waybilla
 * Dispatches notifications directly via AndroidBridge on Native Android APK,
 * or via ServiceWorkerRegistration.showNotification() on Android Web, iOS Web, and Desktop browsers.
 */

export const triggerOSNotification = async (title: string, options: {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
} = {}) => {
  if (typeof window === 'undefined') {
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

  // 0. Native Android APK via AndroidBridge (Direct Native Status Bar Notification)
  if ((window as any).AndroidBridge) {
    try {
      const bridge = (window as any).AndroidBridge;
      const isEnabled = typeof bridge.areNotificationsEnabled === 'function' ? bridge.areNotificationsEnabled() : true;
      if (isEnabled) {
        if (typeof bridge.showNotification === 'function') {
          bridge.showNotification(title, defaultOptions.body || '', defaultOptions.data?.url || '/customer');
          console.log('[Native AndroidBridge Notification Dispatched]:', title);
          return true;
        } else if (typeof bridge.showWaybillNotification === 'function') {
          bridge.showWaybillNotification(title, defaultOptions.body || '', defaultOptions.tag || '');
          console.log('[Native AndroidBridge Waybill Notification Dispatched]:', title);
          return true;
        } else if (typeof bridge.showTestNotification === 'function') {
          bridge.showTestNotification();
          return true;
        }
      }
    } catch (bridgeErr) {
      console.warn('[AndroidBridge notification error]:', bridgeErr);
    }
  }

  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser environment.');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.log('Notification permission not granted:', Notification.permission);
    return false;
  }

  // 1. Try Service Worker Registration (Required on Android Chrome & PWAs)
  try {
    if ('serviceWorker' in navigator) {
      // Use a timeout to prevent awaiting navigator.serviceWorker.ready from hanging indefinitely if no SW is registered
      const readyWithTimeout = Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
      ]);
      const reg = await readyWithTimeout;
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
