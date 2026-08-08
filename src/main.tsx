import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register Waybilla ServiceWorker (Production only, bypass in development/preview to prevent caching & fetch errors)
if ('serviceWorker' in navigator) {
  const isPreview = window.location.hostname.includes('run.app') || 
                    window.location.hostname.includes('localhost') || 
                    window.location.hostname.includes('127.0.0.1');

  if (isPreview) {
    // Unregister any active service workers in preview to clear stale cache/interceptors
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) console.log('Stale preview ServiceWorker unregistered successfully.');
        });
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('Waybilla ServiceWorker registered: ', reg.scope);
      }).catch((err) => {
        console.log('Waybilla ServiceWorker registration failed: ', err);
      });
    });
  }
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
