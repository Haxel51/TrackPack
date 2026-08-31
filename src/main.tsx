import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

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
