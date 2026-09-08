import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { setupCapacitorPushListeners } from './modules/fleetTracking/fcm';

// Early initialization of native Capacitor push listeners on app startup
if (Capacitor.isNativePlatform()) {
  setupCapacitorPushListeners();
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

// Register Firebase Messaging ServiceWorker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').then((reg) => {
      console.log('Firebase Messaging ServiceWorker registered:', reg.scope);
    }).catch((err) => {
      console.warn('Firebase Messaging ServiceWorker registration notice:', err);
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
