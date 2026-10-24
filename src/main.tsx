import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { setupCapacitorPushListeners } from './modules/fleetTracking/fcm';

// Early initialization of native Capacitor push listeners on app startup if plugin available
if (typeof window !== 'undefined' && Capacitor.isPluginAvailable('PushNotifications')) {
  try {
    setupCapacitorPushListeners();
  } catch (e) {
    console.warn('[FCM] Native push init skipped on web:', e);
  }
}

// Global Fetch Interceptor for Capacitor WebView compatibility
if (typeof window !== 'undefined') {
  try {
    const originalFetch = window.fetch;
    if (originalFetch) {
      const patchedFetch = function (input: RequestInfo | URL, init?: RequestInit) {
        let rawUrl = '';
        if (typeof input === 'string') {
          rawUrl = input;
        } else if (input instanceof URL) {
          rawUrl = input.toString();
        } else if (input && typeof (input as Request).url === 'string') {
          rawUrl = (input as Request).url;
        }

        const origin = window.location.origin || '';
        const isCapacitor =
          (window as any).Capacitor?.isNativePlatform?.() ||
          origin.startsWith('capacitor://') ||
          origin.startsWith('file://') ||
          (origin.includes('localhost') && !(window as any).__IS_DEV_SERVER__);

        if (rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
          const defaultHost = (import.meta.env.VITE_API_BASE_URL || 'https://trackpack.onrender.com').replace(/\/$/, '');
          const targetBase = isCapacitor ? defaultHost : '';
          if (targetBase) {
            const fullUrl = `${targetBase}${rawUrl}`;
            if (typeof input === 'string') {
              input = fullUrl;
            } else if (input instanceof URL) {
              input = new URL(fullUrl);
            } else {
              input = new Request(fullUrl, input as RequestInit);
            }
          }
        }
        return originalFetch.call(this, input, init);
      };

      try {
        (window as any).fetch = patchedFetch;
      } catch {
        try {
          Object.defineProperty(window, 'fetch', {
            value: patchedFetch,
            writable: true,
            configurable: true,
          });
        } catch {
          // If fetch is un-redefinable in this environment, safe fallback
        }
      }
    }
  } catch (e) {
    console.warn('Fetch interceptor notice:', e);
  }
}

// Register Universal Service Worker for offline caching, background sync, and push notifications
if ('serviceWorker' in navigator) {
  // Purge any stale client caches if version changed
  if (typeof caches !== 'undefined' && localStorage.getItem('wb_sw_v') !== 'v50') {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name !== 'waybilla-offline-cache-v50') {
          caches.delete(name);
        }
      });
    });
    localStorage.setItem('wb_sw_v', 'v50');
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('Waybilla Universal ServiceWorker registered successfully:', reg.scope);
      // Immediately check for SW update on each page load
      reg.update().catch(() => {});

      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        }
      });

      // Attempt background sync registration if supported by browser
      if ('sync' in reg) {
        (reg as any).sync.register('waybilla-sync').catch(() => {});
      }
    }).catch((err) => {
      console.warn('ServiceWorker registration notice:', err);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'WAYBILLA_TRIGGER_OFFLINE_SYNC') {
        const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
        if (token) {
          import('./lib/offlineWaybillSync').then(({ syncOfflineWaybills }) => {
            syncOfflineWaybills(token);
          });
        }
      }
    });
  });
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
