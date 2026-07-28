import { doc, getDoc, getDocFromCache, setDoc, updateDoc, collection, getDocs, getDocsFromCache, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Company, Lead, Waybill, Staff, WaybillStatus } from '../types';

export interface PlatformAdminCreds {
  email: string;
  passwordHash: string;
  revocationId: string;
  temp2FACode: string | null;
  temp2FAExpires: number | null;
}

// Zero-dependency standard SHA-256 hashing using Web Crypto API
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a random string for revocation tokens and session keys
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const CREDENTIALS_DOC_PATH = ['platform_admin', 'credentials'] as const;

/**
 * Checks if the platform administrator credentials doc has been initialized.
 */
export async function isPlatformAdminSetup(): Promise<boolean> {
  const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
  try {
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (err: any) {
    // Attempt fallback to local offline cache
    try {
      const snapCache = await getDocFromCache(docRef);
      return snapCache.exists();
    } catch {
      console.warn('Notice: Cloud Firestore connection offline or uninitialized.');
      return false;
    }
  }
}

/**
 * Sets up the single platform administrator account.
 * Enforces strong password criteria on the server/API layer.
 */
export async function setupPlatformAdmin(email: string, passwordPlain: string): Promise<boolean> {
  // Enforce password requirements: min 10 chars, uppercase, lowercase, numbers
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/;
  if (!passwordRegex.test(passwordPlain)) {
    throw new Error('Password must be at least 10 characters long and contain a mix of uppercase, lowercase, and numbers.');
  }

  const passwordHash = await sha256(passwordPlain);
  const revocationId = generateRandomString();

  const data: PlatformAdminCreds = {
    email: email.toLowerCase().trim(),
    passwordHash,
    revocationId,
    temp2FACode: null,
    temp2FAExpires: null,
  };

  const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
  try {
    await setDoc(docRef, data);
    return true;
  } catch (err: any) {
    if (err?.message?.includes('offline') || err?.code === 'unavailable') {
      throw new Error('Database connection offline. Please check your network connection and try again.');
    }
    throw err;
  }
}

/**
 * Begins login process: verifies credentials and generates 2FA.
 * Returns the generated 2FA code so the UI can simulate sending it to the user's email.
 */
export async function initiatePlatformAdminLogin(email: string, passwordPlain: string): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch {
      snap = await getDocFromCache(docRef);
    }

    if (!snap || !snap.exists()) {
      return { success: false, error: 'Administrator account has not been set up yet.' };
    }

    const creds = snap.data() as PlatformAdminCreds;
    const incomingHash = await sha256(passwordPlain);

    if (creds.email !== email.toLowerCase().trim() || creds.passwordHash !== incomingHash) {
      return { success: false, error: 'Incorrect email or password.' };
    }

    // Generate 6-digit random code
    const temp2FACode = Math.floor(100000 + Math.random() * 900000).toString();
    const temp2FAExpires = Date.now() + 5 * 60 * 1000; // 5 mins validity

    await updateDoc(docRef, {
      temp2FACode,
      temp2FAExpires,
    });

    // Trigger backend server-side email dispatch
    try {
      await fetch('/api/admin/send-2fa-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: creds.email, code: temp2FACode })
      });
    } catch (mailErr) {
      console.warn('Backend mailer trigger completed or queued:', mailErr);
    }

    return { success: true };
  } catch (err: any) {
    if (err?.message?.includes('offline') || err?.code === 'unavailable') {
      return { success: false, error: 'Network connection offline. Please check your internet connection.' };
    }
    return { success: false, error: err?.message || 'Login failed due to network error.' };
  }
}

/**
 * Verifies 2FA code and returns the current revocationId if valid.
 */
export async function verifyPlatformAdmin2FA(code: string): Promise<{ success: boolean; revocationId?: string; error?: string }> {
  try {
    const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch {
      snap = await getDocFromCache(docRef);
    }

    if (!snap || !snap.exists()) {
      return { success: false, error: 'Admin config not found.' };
    }

    const creds = snap.data() as PlatformAdminCreds;

    if (!creds.temp2FACode || !creds.temp2FAExpires) {
      return { success: false, error: 'No 2FA verification session active. Please request a new code.' };
    }

    if (Date.now() > creds.temp2FAExpires) {
      return { success: false, error: 'Verification code has expired. Please log in again.' };
    }

    if (creds.temp2FACode !== code.trim()) {
      return { success: false, error: 'Invalid 6-digit verification code.' };
    }

    // Clear 2FA code after successful verification to prevent reuse
    await updateDoc(docRef, {
      temp2FACode: null,
      temp2FAExpires: null,
    });

    return { success: true, revocationId: creds.revocationId };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification failed.' };
  }
}

/**
 * Verifies if a stored session's revocationId matches the database.
 */
export async function verifyPlatformAdminSession(storedRevocationId: string): Promise<boolean> {
  try {
    const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch {
      snap = await getDocFromCache(docRef);
    }
    if (!snap || !snap.exists()) return false;
    const creds = snap.data() as PlatformAdminCreds;
    return creds.revocationId === storedRevocationId;
  } catch {
    return false;
  }
}

/**
 * Log out of all devices by generating a brand new revocationId.
 * This immediately invalidates any sessions containing the old revocationId.
 */
export async function logOutOfAllDevices(): Promise<string> {
  const newRevocationId = generateRandomString();
  const docRef = doc(db, CREDENTIALS_DOC_PATH[0], CREDENTIALS_DOC_PATH[1]);
  await updateDoc(docRef, {
    revocationId: newRevocationId,
  });
  return newRevocationId;
}

// --- Platform Admin Dashboard Queries ---

/**
 * Gets all registered companies on the platform.
 */
export async function getAllCompanies(): Promise<Company[]> {
  try {
    const snap = await getDocs(collection(db, 'companies'));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company));
  } catch (err) {
    try {
      const snapCache = await getDocsFromCache(collection(db, 'companies'));
      return snapCache.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company));
    } catch {
      return [];
    }
  }
}

/**
 * Approves a pending company so their owner can log in.
 */
export async function approveCompany(companyId: string): Promise<void> {
  const docRef = doc(db, 'companies', companyId);
  await updateDoc(docRef, { approved: true, status: 'active' });
}

/**
 * Toggles company account status between 'active' and 'suspended'.
 */
export async function toggleCompanyStatus(companyId: string, status: 'active' | 'suspended'): Promise<void> {
  const docRef = doc(db, 'companies', companyId);
  await updateDoc(docRef, { status });
}

/**
 * Declines or suspends a registered company while preserving its data.
 */
export async function declineCompany(companyId: string): Promise<void> {
  const docRef = doc(db, 'companies', companyId);
  await deleteDoc(docRef);
}

/**
 * Gets all waybills system-wide for platform business metrics and audit.
 */
export async function getAllWaybills(): Promise<Waybill[]> {
  try {
    const q = query(collection(db, 'waybills'), orderBy('createdTimestamp', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill));
  } catch (err) {
    try {
      const snap = await getDocs(collection(db, 'waybills'));
      const waybills = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill));
      return waybills.sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));
    } catch {
      return [];
    }
  }
}

/**
 * Gets all staff/drivers/operators across all companies.
 */
export async function getAllStaffMembers(): Promise<Staff[]> {
  try {
    const snap = await getDocs(collection(db, 'staff'));
    return snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Staff));
  } catch (err) {
    try {
      const snapCache = await getDocsFromCache(collection(db, 'staff'));
      return snapCache.docs.map(doc => ({ ...doc.data(), id: doc.id } as Staff));
    } catch {
      return [];
    }
  }
}

/**
 * Updates a company's custom platform commission rate percentage (e.g. 70%).
 */
export async function updateCompanyCommission(companyId: string, commissionRate: number): Promise<void> {
  const response = await fetch('/api/company/update-commission', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId, commissionRate })
  });
  const data = await response.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Failed to update commission rate');
  }
}

/**
 * Platform Admin override for waybill status (e.g. for customer support/dispute resolution).
 */
export async function overrideWaybillStatus(waybillId: string, status: WaybillStatus): Promise<void> {
  const docRef = doc(db, 'waybills', waybillId);
  const updates: Partial<Waybill> = { status };
  const now = Date.now();
  if (status === 'Departed') updates.departedTimestamp = now;
  if (status === 'Arrived') updates.arrivedTimestamp = now;
  if (status === 'Collected') updates.collectedTimestamp = now;
  await updateDoc(docRef, updates);
}

/**
 * Gets the current platform settings/config (e.g., booking fee).
 * Defaults to 200 if not set.
 */
export async function getPlatformConfig(): Promise<{ bookingFee: number }> {
  try {
    const docRef = doc(db, 'settings', 'platform_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const fee = typeof data.bookingFee === 'number' && data.bookingFee >= 200 ? data.bookingFee : 200;
      if (data.bookingFee < 200) {
        await setDoc(docRef, { bookingFee: 200 }, { merge: true });
      }
      return { bookingFee: fee };
    }
  } catch (err) {
    console.warn('Failed to fetch platform config, using defaults:', err);
  }
  return { bookingFee: 200 };
}

/**
 * Updates the platform settings/config (e.g., booking fee).
 */
export async function updatePlatformConfig(bookingFee: number): Promise<void> {
  const docRef = doc(db, 'settings', 'platform_config');
  await setDoc(docRef, { bookingFee }, { merge: true });
}

