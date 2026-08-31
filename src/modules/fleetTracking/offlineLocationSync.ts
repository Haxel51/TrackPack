// Offline Location Buffering & Silent Retry Logic for Fleet Tracking Driver GPS
import { updateTripGps } from './api';

const DB_NAME = 'fleetTrackingOffline';
const STORE_NAME = 'pendingLocations';
const DB_VERSION = 1;

export interface PendingLocationRecord {
  id?: number;
  tripId: string;
  lat: number;
  lng: number;
  timestamp: string;
  attempts: number;
}

// Open IndexedDB safely with promise wrapper
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Failed to open IndexedDB'));
    };
  });
}

// 1. Store failed location update in IndexedDB
export async function storeLocationOffline(tripId: string, lat: number, lng: number, timestamp?: string): Promise<void> {
  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: PendingLocationRecord = {
      tripId,
      lat,
      lng,
      timestamp: timestamp || new Date().toISOString(),
      attempts: 0
    };

    store.add(record);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log('[Offline Buffer] Location stored in IndexedDB for trip', tripId);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Offline Buffer] Failed to store location in IndexedDB:', err);
  }
}

// 2. Flush all pending locations to Firestore / Server when online
export async function flushPendingLocations(token: string): Promise<number> {
  if (!token || typeof window === 'undefined' || !window.indexedDB) return 0;

  try {
    const db = await openOfflineDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getAllReq = store.getAll();

    return new Promise((resolve) => {
      getAllReq.onsuccess = async () => {
        const pending: PendingLocationRecord[] = getAllReq.result || [];
        if (pending.length === 0) {
          resolve(0);
          return;
        }

        console.log(`[Offline Buffer] Flushing ${pending.length} pending location(s)...`);
        let flushedCount = 0;

        for (const loc of pending) {
          try {
            const res = await updateTripGps(token, loc.tripId, {
              lat: loc.lat,
              lng: loc.lng
            });

            if (res.success) {
              // Delete successfully flushed item
              if (loc.id !== undefined) {
                const deleteTx = db.transaction(STORE_NAME, 'readwrite');
                deleteTx.objectStore(STORE_NAME).delete(loc.id);
              }
              flushedCount++;
            }
          } catch (error) {
            console.error('[Offline Buffer] Failed to flush location:', error);
          }
        }

        resolve(flushedCount);
      };

      getAllReq.onerror = () => {
        resolve(0);
      };
    });
  } catch (err) {
    console.warn('[Offline Buffer] Flush pending locations error:', err);
    return 0;
  }
}

// 3. Silent Retry Logic (30-second retry, up to 3 attempts, then store in IndexedDB)
export async function sendLocationWithRetry(
  token: string,
  tripId: string,
  lat: number,
  lng: number,
  attempt: number = 1
): Promise<{ success: boolean; trip?: any }> {
  try {
    const res = await updateTripGps(token, tripId, { lat, lng });
    if (res.success) {
      return res;
    }
    throw new Error(res.error || 'Update failed');
  } catch (error) {
    console.warn(`[GPS Retry] Attempt ${attempt}/3 failed for trip ${tripId}:`, error);

    if (attempt < 3) {
      // 30-second retry
      setTimeout(() => {
        sendLocationWithRetry(token, tripId, lat, lng, attempt + 1);
      }, 30000);
      return { success: false };
    } else {
      // Maximum 3 retries reached — store in IndexedDB for later
      console.log('[GPS Retry] 3 attempts exhausted, buffering offline...');
      await storeLocationOffline(tripId, lat, lng);
      return { success: false };
    }
  }
}
