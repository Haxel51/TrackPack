import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import mapsConfig from '../../../config/maps.config';

let configuredKey: string | null = null;
let scriptLoadingPromise: Promise<typeof google.maps> | null = null;

export function resetGoogleMapsLoader() {
  configuredKey = null;
  scriptLoadingPromise = null;
  const scripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
  scripts.forEach((s) => s.remove());
}

/**
 * Robust loader for Google Maps JavaScript API.
 * Handles slow network connections, prevents callback collisions,
 * and seamlessly falls back between js-api-loader and direct script injection.
 */
export async function loadGoogleMaps(apiKey?: string, forceReload: boolean = false): Promise<typeof google.maps> {
  const key = (apiKey?.trim() || mapsConfig.apiKey?.trim() || '').trim();
  if (!key) {
    throw new Error('Google Maps API key is missing.');
  }

  if (typeof window === 'undefined') {
    throw new Error('Window is not defined in current environment.');
  }

  if (forceReload) {
    resetGoogleMapsLoader();
  }

  // 1. If already loaded and Map constructor is ready, return immediately
  if (window.google?.maps?.Map) {
    return window.google.maps;
  }

  if (scriptLoadingPromise && !forceReload) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<typeof google.maps>(async (resolve, reject) => {
    let resolved = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    // Fast polling: check if window.google.maps becomes ready
    pollInterval = setInterval(() => {
      if (window.google?.maps?.Map) {
        resolved = true;
        cleanup();
        resolve(window.google.maps);
      }
    }, 100);

    // 30-second network-tolerant timeout (handles high-latency / 3G mobile connections)
    timeoutId = setTimeout(() => {
      cleanup();
      if (window.google?.maps?.Map) {
        resolved = true;
        resolve(window.google.maps);
      } else if (!resolved) {
        resetGoogleMapsLoader();
        reject(new Error('Google Maps loading timed out. Please check your network connection and retry.'));
      }
    }, 30000);

    try {
      // Strategy 1: Use official @googlemaps/js-api-loader
      try {
        if (configuredKey !== key) {
          configuredKey = key;
          setOptions({
            key: key,
            v: 'weekly',
            region: mapsConfig.region || 'NG',
            language: mapsConfig.language || 'en',
            solutionChannel: 'gmp_mcp_codeassist_v1_aistudio',
          });
        }

        await Promise.allSettled([
          importLibrary('maps'),
          importLibrary('places'),
          importLibrary('geometry'),
          importLibrary('marker'),
        ]);

        if (window.google?.maps?.Map) {
          resolved = true;
          cleanup();
          resolve(window.google.maps);
          return;
        }
      } catch (loaderErr) {
        console.warn('Google Maps js-api-loader notice, falling back to direct script tag:', loaderErr);
      }

      // Strategy 2: Direct script tag injection fallback
      if (!window.google?.maps?.Map) {
        // Clean up any stale/hung script elements before injecting a fresh one
        const oldScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
        oldScripts.forEach((s) => s.remove());

        const callbackName = `__gmaps_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        (window as any)[callbackName] = () => {
          try {
            delete (window as any)[callbackName];
          } catch (_) {}
          if (window.google?.maps?.Map) {
            resolved = true;
            cleanup();
            resolve(window.google.maps);
          }
        };

        const script = document.createElement('script');
        script.id = 'google-maps-direct-script';
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;
        const libList = (mapsConfig.libraries || ['places', 'geometry']).join(',');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libList}&region=${mapsConfig.region || 'NG'}&language=${mapsConfig.language || 'en'}&v=weekly&callback=${callbackName}`;

        script.onerror = () => {
          try {
            delete (window as any)[callbackName];
          } catch (_) {}
          cleanup();
          resetGoogleMapsLoader();
          reject(new Error('Failed to load Google Maps script. Please check your network connection.'));
        };

        document.head.appendChild(script);
      }
    } catch (err) {
      cleanup();
      resetGoogleMapsLoader();
      reject(err);
    }
  });

  return scriptLoadingPromise;
}

