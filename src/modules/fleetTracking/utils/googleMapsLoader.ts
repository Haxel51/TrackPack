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
 * Handles existing script tags, prevents duplicate callback collisions,
 * and includes fallback timeout resolution so the UI never hangs forever.
 */
export async function loadGoogleMaps(apiKey?: string): Promise<typeof google.maps> {
  const key = (apiKey?.trim() || mapsConfig.apiKey?.trim() || '').trim();
  if (!key) {
    throw new Error('Google Maps API key is missing.');
  }

  if (typeof window === 'undefined') {
    throw new Error('Window is not defined in current environment.');
  }

  // 1. If already loaded and Map constructor is ready, return immediately
  if (window.google?.maps?.Map) {
    return window.google.maps;
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<typeof google.maps>(async (resolve, reject) => {
    let resolved = false;

    // Safety timeout: check if window.google.maps becomes ready via polling
    const pollInterval = setInterval(() => {
      if (window.google?.maps?.Map) {
        resolved = true;
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        resolve(window.google.maps);
      }
    }, 150);

    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      if (window.google?.maps?.Map) {
        resolved = true;
        resolve(window.google.maps);
      } else if (!resolved) {
        scriptLoadingPromise = null;
        reject(new Error('Google Maps loading timed out. Please check your network connection.'));
      }
    }, 10000);

    try {
      // If script is already attached on page, just wait for polling
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (!existingScript) {
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

          // Import standard valid library modules
          await Promise.allSettled([
            importLibrary('maps'),
            importLibrary('places'),
            importLibrary('geometry'),
            importLibrary('marker'),
          ]);

          if (window.google?.maps?.Map) {
            resolved = true;
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            resolve(window.google.maps);
            return;
          }
        } catch (loaderErr) {
          console.warn('Google Maps js-api-loader notice, using script injection:', loaderErr);
        }

        // Direct script fallback
        if (!window.google?.maps?.Map && !document.querySelector('script[src*="maps.googleapis.com"]')) {
          const callbackName = `__gmaps_cb_${Date.now()}`;
          (window as any)[callbackName] = () => {
            try {
              delete (window as any)[callbackName];
            } catch (_) {}
            if (window.google?.maps?.Map) {
              resolved = true;
              clearInterval(pollInterval);
              clearTimeout(timeoutId);
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
            scriptLoadingPromise = null;
            clearInterval(pollInterval);
            clearTimeout(timeoutId);
            reject(new Error('Failed to load Google Maps script.'));
          };

          document.head.appendChild(script);
        }
      }
    } catch (err) {
      scriptLoadingPromise = null;
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
      reject(err);
    }
  });

  return scriptLoadingPromise;
}
