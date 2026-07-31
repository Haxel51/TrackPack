import { collection, doc, getDocs, getDocsFromCache, getDoc, getDocFromCache, query, where, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Company, Staff, Waybill, WaybillStatus, Lead } from '../types';
import { normalizeTo11Digits } from './helpers';

// Leads
export async function createLead(lead: Omit<Lead, 'id'>): Promise<Lead> {
  const docRef = await addDoc(collection(db, 'leads'), lead);
  return { ...lead, id: docRef.id };
}

export async function getLeads(): Promise<Lead[]> {
  const q = query(collection(db, 'leads'), orderBy('timestamp', 'desc'));
  try {
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lead));
  } catch (err) {
    try {
      const snapCache = await getDocsFromCache(q);
      return snapCache.docs.map(doc => ({ ...doc.data(), id: doc.id } as Lead));
    } catch {
      return [];
    }
  }
}

// Staff & Company
export async function getStaffByPin(pin: string): Promise<Staff | null> {
  const q = query(collection(db, 'staff'), where('pin', '==', pin));
  try {
    let snap;
    try {
      snap = await getDocs(q);
    } catch {
      snap = await getDocsFromCache(q);
    }
    if (snap.empty) return null;
    const data = snap.docs[0].data() as Staff;
    if (data.isActive === false) return null;

    // Verify company existence and active status
    if (data.companyId) {
      try {
        const compRef = doc(db, 'companies', data.companyId);
        const compSnap = await getDoc(compRef);
        if (!compSnap.exists()) return null; // Company removed by super admin
        const compData = compSnap.data();
        if (compData.approved !== true || compData.status === 'suspended') return null; // Company suspended/unapproved
      } catch (cErr) {
        console.warn('Company verification check error:', cErr);
      }
    }

    return { ...data, id: snap.docs[0].id };
  } catch {
    return null;
  }
}

export async function getCompanyByPhone(phone: string): Promise<Company | null> {
  const q = query(collection(db, 'companies'), where('ownerPhone', '==', phone));
  try {
    let snap;
    try {
      snap = await getDocs(q);
    } catch {
      snap = await getDocsFromCache(q);
    }
    if (snap.empty) return null;
    const data = snap.docs[0].data() as Company;
    return { ...data, id: snap.docs[0].id };
  } catch {
    return null;
  }
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const docRef = doc(db, 'companies', id);
  try {
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch {
      snap = await getDocFromCache(docRef);
    }
    if (!snap || !snap.exists()) return null;
    return { ...(snap.data() as Company), id: snap.id };
  } catch {
    return null;
  }
}

export async function createCompany(company: Omit<Company, 'id'>): Promise<Company> {
  const docRef = await addDoc(collection(db, 'companies'), company);
  return { ...company, id: docRef.id };
}

export async function createStaff(staff: Omit<Staff, 'id'>): Promise<Staff> {
  const newStaff = { ...staff, isActive: true };
  const docRef = await addDoc(collection(db, 'staff'), newStaff);
  return { ...newStaff, id: docRef.id };
}

export async function updateStaffStatus(staffId: string, isActive: boolean): Promise<void> {
  const docRef = doc(db, 'staff', staffId);
  await updateDoc(docRef, { isActive });
}

export async function getCompanyStaff(companyId: string): Promise<Staff[]> {
  try {
    const q = query(collection(db, 'staff'), where('companyId', '==', companyId));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Staff));
  } catch (err) {
    console.error("Error getCompanyStaff:", err);
    return [];
  }
}

export async function addParkToCompany(companyId: string, parkName: string): Promise<void> {
  const compRef = doc(db, 'companies', companyId);
  const snap = await getDoc(compRef);
  if (snap.exists()) {
    const parks = snap.data().parks || [];
    if (!parks.includes(parkName)) {
      await updateDoc(compRef, { parks: [...parks, parkName] });
    }
  }
}

export function isSamePark(parkA?: string, parkB?: string): boolean {
  if (!parkA || !parkB) return false;
  const rawA = parkA.trim().toLowerCase();
  const rawB = parkB.trim().toLowerCase();
  if (rawA === rawB) return true;

  const cleanA = rawA.replace(/\b(motor|park|terminal|station|branch)\b/gi, '').trim();
  const cleanB = rawB.replace(/\b(motor|park|terminal|station|branch)\b/gi, '').trim();
  
  if (!cleanA || !cleanB) return rawA === rawB;
  return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
}

// Waybills
export async function createWaybill(waybill: Omit<Waybill, 'id'>): Promise<Waybill> {
  if (isSamePark(waybill.originPark, waybill.destinationPark)) {
    throw new Error("Departure park and Destination park cannot be the same motor park.");
  }
  const docRef = await addDoc(collection(db, 'waybills'), waybill);
  const created = { ...waybill, id: docRef.id };
  if (created.status === 'Booked') {
    triggerServerPushNotification([created.id], 'Booked');
  }
  return created;
}

export async function deleteWaybill(id: string): Promise<void> {
  if (!id) {
    throw new Error("Invalid waybill ID for deletion");
  }
  try {
    await deleteDoc(doc(db, 'waybills', id));
  } catch (err) {
    console.error("Error deleting waybill:", err);
    throw err;
  }
}

export async function getSenderManifest(park: string): Promise<Waybill[]> {
  try {
    const q = query(collection(db, 'waybills'), where('originPark', '==', park), where('status', '==', 'Booked'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill));
  } catch (err) {
    console.error("Error getSenderManifest:", err);
    const qFallback = query(collection(db, 'waybills'), where('originPark', '==', park));
    const snap = await getDocs(qFallback);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill)).filter(w => w.status === 'Booked');
  }
}

export async function markBusDeparted(busNumber: string, park: string, driverName: string, driverPhone: string): Promise<void> {
  let docsToUpdate = [];
  try {
    const q = query(collection(db, 'waybills'), where('busNumber', '==', busNumber), where('originPark', '==', park), where('status', '==', 'Booked'));
    const snap = await getDocs(q);
    docsToUpdate = snap.docs;
  } catch (err) {
    console.error("Error in markBusDeparted query:", err);
    const qFallback = query(collection(db, 'waybills'), where('busNumber', '==', busNumber));
    const snap = await getDocs(qFallback);
    docsToUpdate = snap.docs.filter(d => {
      const data = d.data();
      return data.originPark === park && data.status === 'Booked';
    });
  }

  const batch = writeBatch(db);
  const now = Date.now();
  const waybillIds: string[] = [];
  
  docsToUpdate.forEach(docSnap => {
    waybillIds.push(docSnap.id);
    batch.update(docSnap.ref, {
      status: 'Departed',
      departedTimestamp: now,
      driverName,
      driverPhone
    });
  });
  
  await batch.commit();
  triggerServerPushNotification(waybillIds, 'Departed');
}

export async function getIncomingBuses(park: string): Promise<Waybill[]> {
  try {
    const q = query(collection(db, 'waybills'), where('destinationPark', '==', park), where('status', '==', 'Departed'));
    const snap = await getDocs(q);
    return snap.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as Waybill))
      .filter(w => w.originPark !== park);
  } catch (err) {
    console.error("Error getting incoming buses:", err);
    // fallback if composite index is missing
    const qFallback = query(collection(db, 'waybills'), where('destinationPark', '==', park));
    const snap = await getDocs(qFallback);
    return snap.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as Waybill))
      .filter(w => w.status === 'Departed' && w.originPark !== park);
  }
}

export async function markBusArrived(busNumber: string, destinationPark: string): Promise<void> {
  let docsToUpdate = [];
  try {
    const q = query(collection(db, 'waybills'), where('busNumber', '==', busNumber), where('destinationPark', '==', destinationPark), where('status', '==', 'Departed'));
    const snap = await getDocs(q);
    docsToUpdate = snap.docs;
  } catch (err) {
    console.error("Error in markBusArrived query:", err);
    const qFallback = query(collection(db, 'waybills'), where('busNumber', '==', busNumber));
    const snap = await getDocs(qFallback);
    docsToUpdate = snap.docs.filter(d => {
      const data = d.data();
      return data.destinationPark === destinationPark && data.status === 'Departed';
    });
  }

  const batch = writeBatch(db);
  const now = Date.now();
  const waybillIds: string[] = [];
  
  // Group trips to update routes together
  const routeTripsToLog: Record<string, { originPark: string; destinationPark: string; trips: any[] }> = {};

  docsToUpdate.forEach(docSnap => {
    const data = docSnap.data();
    waybillIds.push(docSnap.id);
    batch.update(docSnap.ref, {
      status: 'Arrived',
      arrivedTimestamp: now,
    });

    if (data.originPark && data.destinationPark && data.departedTimestamp) {
      const departed = data.departedTimestamp;
      if (now > departed) {
        const durationHours = (now - departed) / (1000 * 60 * 60);
        const depDate = new Date(departed);
        const dayOfWeek = depDate.getDay();
        const hourOfDay = depDate.getHours();

        const routeId = `${data.originPark.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}__to__${data.destinationPark.toLowerCase().trim().replace(/[^a-z0-9]/g, '_')}`;
        
        if (!routeTripsToLog[routeId]) {
          routeTripsToLog[routeId] = {
            originPark: data.originPark,
            destinationPark: data.destinationPark,
            trips: []
          };
        }
        routeTripsToLog[routeId].trips.push({
          durationHours,
          timestamp: now,
          dayOfWeek,
          hourOfDay,
          waybillId: docSnap.id
        });
      }
    }
  });
  
  await batch.commit();

  // Write completed trip logs to routes
  for (const [routeId, routeInfo] of Object.entries(routeTripsToLog)) {
    try {
      const routeRef = doc(db, 'routes', routeId);
      const routeSnap = await getDoc(routeRef);
      let completedTrips = [];
      let initialEstimateHours = 6; // default starting hours

      if (routeSnap.exists()) {
        const rData = routeSnap.data();
        completedTrips = rData.completedTrips || [];
        initialEstimateHours = rData.initialEstimateHours || rData.distanceKm / 60 || 6;
      }

      completedTrips.push(...routeInfo.trips);
      // Sort by descending timestamp and limit to 30 elements
      completedTrips.sort((a: any, b: any) => b.timestamp - a.timestamp);
      const trimmedTrips = completedTrips.slice(0, 30);

      await setDoc(routeRef, {
        originPark: routeInfo.originPark,
        destinationPark: routeInfo.destinationPark,
        initialEstimateHours,
        completedTrips: trimmedTrips,
        updatedAt: now
      }, { merge: true });

      console.log(`[SELF-LEARNING ETA] Logged ${routeInfo.trips.length} completed trip(s) on route ${routeInfo.originPark} -> ${routeInfo.destinationPark}`);
    } catch (routeErr) {
      console.error(`[SELF-LEARNING ETA ERROR] Failed to log completed trip for route ${routeId}:`, routeErr);
    }
  }

  triggerServerPushNotification(waybillIds, 'Arrived');
}

export async function getCustomerWaybills(phone: string): Promise<Waybill[]> {
  const normalized = normalizeTo11Digits(phone);
  // To avoid complex index requirements right now, we can query both and combine, or just query all and filter, but let's query sender and receiver.
  const senderQ = query(collection(db, 'waybills'), where('senderPhone', '==', normalized));
  const receiverQ = query(collection(db, 'waybills'), where('receiverPhone', '==', normalized));
  
  const [senderSnap, receiverSnap] = await Promise.all([getDocs(senderQ), getDocs(receiverQ)]);
  
  const waybillsMap = new Map<string, Waybill>();
  senderSnap.docs.forEach(doc => waybillsMap.set(doc.id, { ...doc.data(), id: doc.id } as Waybill));
  receiverSnap.docs.forEach(doc => waybillsMap.set(doc.id, { ...doc.data(), id: doc.id } as Waybill));
  
  return Array.from(waybillsMap.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

export async function getWaybillByTracking(trackingCode: string): Promise<Waybill | null> {
  const q = query(collection(db, 'waybills'), where('trackingCode', '==', trackingCode));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data() as Waybill;
  return { ...data, id: snap.docs[0].id };
}

export async function markWaybillCollected(waybillId: string, pickupCode: string): Promise<boolean> {
  const docRef = doc(db, 'waybills', waybillId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;
  
  const data = snap.data() as Waybill;
  if (data.pickupCode !== pickupCode || data.status !== 'Arrived') return false;
  
  await updateDoc(docRef, {
    status: 'Collected',
    collectedTimestamp: Date.now(),
  });
  triggerServerPushNotification([waybillId], 'Collected');
  return true;
}

export async function markWaybillCollectedByStaff(waybillId: string, note?: string): Promise<boolean> {
  const docRef = doc(db, 'waybills', waybillId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;
  
  await updateDoc(docRef, {
    status: 'Collected',
    collectedTimestamp: Date.now(),
    verifiedByStaffNote: note || 'Verified in park store'
  });
  triggerServerPushNotification([waybillId], 'Collected');
  return true;
}

export async function getArrivedWaybillsForPark(parkName: string): Promise<Waybill[]> {
  try {
    const q = query(collection(db, 'waybills'), where('destinationPark', '==', parkName), where('status', '==', 'Arrived'));
    const snap = await getDocs(q);
    return snap.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as Waybill))
      .filter(w => w.originPark !== parkName);
  } catch (err) {
    console.error("Error getting arrived waybills:", err);
    const qFallback = query(collection(db, 'waybills'), where('destinationPark', '==', parkName));
    const snap = await getDocs(qFallback);
    return snap.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as Waybill))
      .filter(w => w.status === 'Arrived' && w.originPark !== parkName);
  }
}

export async function getCompanyWaybills(parks: string[]): Promise<Waybill[]> {
  if (!parks.length) return [];
  try {
    const qOrigin = query(collection(db, 'waybills'), where('originPark', 'in', parks));
    const snapOrigin = await getDocs(qOrigin);
    const qDest = query(collection(db, 'waybills'), where('destinationPark', 'in', parks));
    const snapDest = await getDocs(qDest);
    
    const waybillsMap = new Map<string, Waybill>();
    snapOrigin.docs.forEach(doc => waybillsMap.set(doc.id, { ...doc.data(), id: doc.id } as Waybill));
    snapDest.docs.forEach(doc => waybillsMap.set(doc.id, { ...doc.data(), id: doc.id } as Waybill));
    
    return Array.from(waybillsMap.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  } catch (err) {
    console.error("Error getCompanyWaybills:", err);
    return [];
  }
}

export async function updatePushPreference(phone: string, enabled: boolean): Promise<void> {
  const docRef = doc(db, 'customer_accounts', phone);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, { pushEnabled: enabled });
    } else {
      await setDoc(docRef, { phone, pushEnabled: enabled, failedAttempts: 0, lockoutUntil: 0 }, { merge: true });
    }
  } catch (err) {
    console.error("Error updating push preference:", err);
  }
}

export async function getPushPreference(phone: string): Promise<boolean | null> {
  const docRef = doc(db, 'customer_accounts', phone);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().pushEnabled ?? null;
    }
  } catch (err) {
    console.error("Error reading push preference:", err);
  }
  return null;
}

async function triggerServerPushNotification(waybillIds: string[], newStatus: string): Promise<void> {
  if (!waybillIds || waybillIds.length === 0) return;
  try {
    await fetch('/api/push/notify-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waybillIds, newStatus })
    });
  } catch (err) {
    console.error('[CLIENT PUSH] Failed to trigger backend status push update:', err);
  }
}

// Helper to convert VAPID public key string to a Uint8Array needed by subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Service Worker & Web Push Registration Orchestrator
export async function registerPushNotification(phone: string): Promise<boolean> {
  if (!phone) return false;
  const normalized = normalizeTo11Digits(phone);

  // 1. Always store push preference in localStorage and database first
  try {
    localStorage.setItem(`push_pref_${normalized}`, 'true');
    await updatePushPreference(normalized, true);
  } catch (e) {
    console.warn('[CLIENT PUSH] Local/DB preference save warning:', e);
  }

  // 2. Request Notification permission if supported and default
  if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    try {
      await Notification.requestPermission();
    } catch (e) {
      console.warn('[CLIENT PUSH] Permission request warning:', e);
    }
  }

  // 3. Register user phone with server for status alert dispatches
  try {
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized, subscription: null })
    });
  } catch (e) {
    console.warn('[CLIENT PUSH] Server registration fallback error:', e);
  }

  // 4. Attempt full Service Worker & PushManager subscription if supported
  if (('serviceWorker' in navigator) && ('PushManager' in window)) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const keyRes = await fetch('/api/push/public-key');
      if (keyRes.ok) {
        const { publicKey } = await keyRes.json();
        if (publicKey) {
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(publicKey)
            });
          }
          if (subscription) {
            await fetch('/api/push/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: normalized, subscription })
            });
            console.log('[CLIENT PUSH] Background service worker subscription active for:', normalized);
          }
        }
      }
    } catch (swErr) {
      console.warn('[CLIENT PUSH] Service Worker push subscription skipped (in-app alerts active):', swErr);
    }
  }

  return true;
}

// Trigger a server-side test background push notification
export async function sendTestPushNotification(phone: string): Promise<boolean> {
  if (!phone) return false;
  const normalized = normalizeTo11Digits(phone);

  // Fire a local browser desktop notification if permission is granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification("TrackPack Test Alert", {
        body: "Awesome! Your phone & browser push alerts are active and connected to TrackPack.",
        icon: "/favicon.ico"
      });
    } catch (e) {
      console.log('[CLIENT PUSH] Local notification fallback:', e);
    }
  }

  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: normalized })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send test push:', err);
    return true; // Return true as notification preference is active
  }
}

// Route distance management functions
export interface RouteDistanceResult {
  status: 'success' | 'fallback' | 'error';
  distanceKm: number;
  source: string;
  isStored?: boolean;
  originPark: string;
  destinationPark: string;
  initialEstimateHours?: number;
  completedTrips?: any[];
  message?: string;
}

export async function fetchRouteDistance(
  originPark: string, 
  destinationPark: string, 
  forceManualKm?: number,
  initialEstimateHours?: number
): Promise<RouteDistanceResult> {
  try {
    const res = await fetch('/api/routes/distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originPark, destinationPark, forceManualKm, initialEstimateHours })
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Failed to fetch route distance:', err);
    return {
      status: 'error',
      distanceKm: 0,
      source: 'error',
      originPark,
      destinationPark,
      message: err.message || 'Network error fetching distance'
    };
  }
}

export async function saveRouteDistance(
  originPark: string, 
  destinationPark: string, 
  distanceKm: number,
  initialEstimateHours?: number
): Promise<boolean> {
  try {
    const res = await fetch('/api/routes/save-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originPark, destinationPark, distanceKm, initialEstimateHours })
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save route distance:', err);
    return false;
  }
}

export async function getStoredRoutes(): Promise<any[]> {
  try {
    const res = await fetch('/api/routes/list');
    const data = await res.json();
    return data.routes || [];
  } catch (err) {
    console.error('Failed to list routes:', err);
    return [];
  }
}
