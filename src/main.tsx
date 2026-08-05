import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register TrackPack ServiceWorker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('TrackPack ServiceWorker registered: ', reg.scope);
    }).catch((err) => {
      console.log('TrackPack ServiceWorker registration failed: ', err);
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
