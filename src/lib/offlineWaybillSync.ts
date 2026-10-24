// Offline-First Waybill Engine for Waybilla
// Enables park clerks & drivers to book waybills, print receipts, and manage manifests
// with zero internet signal, storing locally and auto-syncing when connection restores.

export interface OfflineWaybillPayload {
  offline_id: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  item_description: string;
  bus_id?: string;
  destination_park: string;
  waybill_fee?: number;
  shipping_fee?: number;
  payment_method: 'cash' | 'paystack';
  offline_tracking_code: string;
  created_at: string;
  status: 'pending_sync' | 'syncing' | 'synced' | 'failed';
  sync_error?: string;
  origin_park?: string;
}

const STORAGE_KEY = 'waybilla_offline_waybills_queue_v1';
const CACHED_PARKS_KEY = 'waybilla_cached_parks_v1';
const CACHED_BUSES_KEY = 'waybilla_cached_buses_v1';

// Generate a realistic, instant offline tracking code
export function generateOfflineTrackingCode(originPark: string = 'Nnewi'): string {
  let prefix = 'NNW';
  const norm = (originPark || '').toLowerCase();
  if (norm.includes('onitsha') || norm.includes('upper iweka')) prefix = 'ONT';
  else if (norm.includes('awka')) prefix = 'AWK';
  else if (norm.includes('lagos') || norm.includes('alaba')) prefix = 'LOS';
  else if (norm.includes('abuja')) prefix = 'ABJ';
  else if (norm.includes('enugu')) prefix = 'ENU';
  else if (norm.includes('asaba')) prefix = 'ASB';
  else if (norm.includes('port harcourt') || norm.includes('ph')) prefix = 'PHC';

  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-OFF-${randomDigits}`;
}

// 1. Get all pending offline waybills
export function getOfflineWaybills(): OfflineWaybillPayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read offline waybill queue:', err);
    return [];
  }
}

// 2. Save a new waybill to offline storage
export function saveWaybillOffline(
  payload: Omit<OfflineWaybillPayload, 'offline_id' | 'offline_tracking_code' | 'created_at' | 'status'> & {
    origin_park?: string;
  }
): OfflineWaybillPayload {
  const offline_id = `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const offline_tracking_code = generateOfflineTrackingCode(payload.origin_park || 'Nnewi');
  const created_at = new Date().toISOString();

  const record: OfflineWaybillPayload = {
    ...payload,
    offline_id,
    offline_tracking_code,
    created_at,
    status: 'pending_sync'
  };

  const queue = getOfflineWaybills();
  queue.unshift(record);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyQueueChanged();
  } catch (err) {
    console.error('Failed to save waybill to offline queue:', err);
  }

  return record;
}

// 3. Count of pending items
export function getPendingOfflineCount(): number {
  return getOfflineWaybills().filter(w => w.status !== 'synced').length;
}

// 4. Notify UI components across the app
function notifyQueueChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waybilla:offline-queue-changed', {
      detail: { count: getPendingOfflineCount() }
    }));
  }
}

// 5. Caching & restoring park and bus metadata for offline dropdowns
export function cacheParkMetadata(parks: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(parks)) return;
  try {
    localStorage.setItem(CACHED_PARKS_KEY, JSON.stringify(parks));
  } catch (e) {}
}

export function getCachedParkMetadata(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_PARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function cacheBusMetadata(buses: any[]) {
  if (typeof window === 'undefined' || !Array.isArray(buses)) return;
  try {
    localStorage.setItem(CACHED_BUSES_KEY, JSON.stringify(buses));
  } catch (e) {}
}

export function getCachedBusMetadata(): any[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHED_BUSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

// 6. Sync pending offline waybills with server
export async function syncOfflineWaybills(token: string): Promise<{
  total: number;
  synced: number;
  failed: number;
  errors: string[];
}> {
  const queue = getOfflineWaybills();
  const pending = queue.filter(w => w.status !== 'synced');

  if (pending.length === 0) {
    return { total: 0, synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const updatedQueue = [...queue];

  for (let i = 0; i < updatedQueue.length; i++) {
    const item = updatedQueue[i];
    if (item.status === 'synced') continue;

    item.status = 'syncing';
    notifyQueueChanged();

    try {
      const res = await fetch('/api/staff/waybills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sender_name: item.sender_name,
          sender_phone: item.sender_phone,
          receiver_name: item.receiver_name,
          receiver_phone: item.receiver_phone,
          item_description: item.item_description,
          bus_id: item.bus_id || 'unassigned',
          destination_park: item.destination_park,
          waybill_fee: item.waybill_fee || 0,
          shipping_fee: item.shipping_fee || 0,
          payment_method: item.payment_method || 'cash',
          offline_id: item.offline_id,
          offline_tracking_code: item.offline_tracking_code,
          offline_created_at: item.created_at
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        item.status = 'synced';
        synced++;
      } else {
        item.status = 'failed';
        item.sync_error = data.error || `Server responded with status ${res.status}`;
        failed++;
        errors.push(`${item.offline_tracking_code}: ${item.sync_error}`);
      }
    } catch (err: any) {
      item.status = 'failed';
      item.sync_error = err?.message || 'Network request failed';
      failed++;
      errors.push(`${item.offline_tracking_code}: Connection failed`);
      // If network is completely unreachable, pause sync loop
      break;
    }
  }

  // Filter out synced items older than 24h, or keep them marked as synced
  // Keeping clean list: remove synced items so queue stays lightweight
  const remainingQueue = updatedQueue.filter(w => w.status !== 'synced');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingQueue));
  } catch (e) {}

  notifyQueueChanged();

  return {
    total: pending.length,
    synced,
    failed,
    errors
  };
}

// 7. Remove an item manually if invalid
export function removeOfflineWaybill(offline_id: string) {
  const queue = getOfflineWaybills().filter(w => w.offline_id !== offline_id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    notifyQueueChanged();
  } catch (e) {}
}
