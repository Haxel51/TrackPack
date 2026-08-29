import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import mapsConfig from '../../../config/maps.config';

let configuredKey: string | null = null;
let scriptLoadingPromise: Promise<typeof google.maps> | null = null;

export function resetGoogleMapsLoader() {
  configuredKey = null;
  scriptLoadingPromise = null;
  const script = document.getElementById('google-maps-js-sdk-direct');
  if (script) {
    script.remove();
  }
}

/**
 * Robust loader for Google Maps JavaScript API.
 * Uses official Google Maps library loader with direct script tag injection fallback.
 * Uses bundled mapsConfig.apiKey by default if no key is provided.
 */
export async function loadGoogleMaps(apiKey?: string): Promise<typeof google.maps> {
  const key = (apiKey?.trim() || mapsConfig.apiKey?.trim() || '').trim();
  if (!key) {
    throw new Error('Google Maps API key is missing.');
  }

  if (typeof window === 'undefined') {
    throw new Error('Window is not defined in current environment.');
  }

  // 1. If already loaded, ensure all necessary libraries are imported
  if (window.google?.maps?.Map) {
    if (window.google.maps.importLibrary) {
      await Promise.allSettled([
        window.google.maps.importLibrary('places'),
        window.google.maps.importLibrary('geocoding'),
        window.google.maps.importLibrary('geometry'),
        window.google.maps.importLibrary('marker'),
      ]);
    }
    return window.google.maps;
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = (async () => {
    try {
      // Try Method A: @googlemaps/js-api-loader dynamic import
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

        await Promise.all([
          importLibrary('maps'),
          importLibrary('places'),
          importLibrary('geocoding'),
          importLibrary('geometry'),
        ]);

        if (window.google?.maps?.Map) {
          return window.google.maps;
        }
      } catch (e) {
        console.warn('Google Maps js-api-loader dynamic import notice, testing direct script bootstrap:', e);
      }

      // Try Method B: Direct script loader with callback
      return await new Promise<typeof google.maps>((resolve, reject) => {
        const scriptId = 'google-maps-js-sdk-direct';
        const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (existing) {
          existing.remove();
        }

        const callbackName = `__gmaps_init_${Date.now()}`;
        (window as any)[callbackName] = async () => {
          try {
            delete (window as any)[callbackName];
          } catch (_) {}
          if (window.google?.maps?.Map) {
            if (window.google.maps.importLibrary) {
              await Promise.allSettled([
                window.google.maps.importLibrary('places'),
                window.google.maps.importLibrary('geocoding'),
                window.google.maps.importLibrary('geometry'),
              ]);
            }
            resolve(window.google.maps);
          } else {
            reject(new Error('Google Maps loaded but google.maps.Map is missing.'));
          }
        };

        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;
        const libList = (mapsConfig.libraries || ['places', 'geometry']).join(',');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=${libList}&region=${mapsConfig.region || 'NG'}&language=${mapsConfig.language || 'en'}&v=weekly&callback=${callbackName}`;

        script.onerror = () => {
          try {
            delete (window as any)[callbackName];
          } catch (_) {}
          reject(
            new Error(
              'Failed to load Google Maps JavaScript API script. Please check your internet connection and API key restrictions.'
            )
          );
        };

        document.head.appendChild(script);
      });
    } catch (error) {
      scriptLoadingPromise = null;
      throw error;
    }
  })();

  return scriptLoadingPromise;
}
