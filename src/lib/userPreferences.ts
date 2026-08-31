import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type ModuleType = 'fleet' | 'waybill';

export async function getSavedModulePreference(userId: string, token?: string | null): Promise<ModuleType | null> {
  if (!userId) return null;

  // 1. Check local cache first for instant UI response
  const cached = localStorage.getItem(`user_module_pref_${userId}`);

  // 2. Query Firestore doc `users/{userId}/preferences` (or subdocument `module`)
  try {
    const prefRef = doc(db, 'users', userId, 'preferences', 'module');
    const docSnap = await getDoc(prefRef);
    if (docSnap.exists() && docSnap.data()?.lastUsedModule) {
      const val = docSnap.data().lastUsedModule as ModuleType;
      localStorage.setItem(`user_module_pref_${userId}`, val);
      return val;
    }

    const directRef = doc(db, 'users', userId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists() && directSnap.data()?.lastUsedModule) {
      const val = directSnap.data().lastUsedModule as ModuleType;
      localStorage.setItem(`user_module_pref_${userId}`, val);
      return val;
    }
  } catch (err) {
    console.warn('Firestore read error for module preference:', err);
  }

  // 3. Fallback to API endpoint if token provided
  if (token) {
    try {
      const res = await fetch('/api/user/preferences', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.lastUsedModule) {
          localStorage.setItem(`user_module_pref_${userId}`, data.lastUsedModule);
          return data.lastUsedModule as ModuleType;
        }
      }
    } catch {
      // ignore
    }
  }

  return (cached as ModuleType) || null;
}

export async function saveModulePreference(userId: string, module: ModuleType, token?: string | null): Promise<void> {
  if (!userId) return;

  localStorage.setItem(`user_module_pref_${userId}`, module);

  // Write to Firestore users/{userId}/preferences
  try {
    const prefRef = doc(db, 'users', userId, 'preferences', 'module');
    await setDoc(prefRef, { lastUsedModule: module, updatedAt: new Date().toISOString() }, { merge: true });

    const directRef = doc(db, 'users', userId);
    await setDoc(directRef, { lastUsedModule: module, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Firestore write error for module preference:', err);
  }

  // Also notify server via API
  if (token) {
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lastUsedModule: module })
      });
    } catch {
      // ignore
    }
  }
}

export async function clearModulePreference(userId: string, token?: string | null): Promise<void> {
  if (!userId) return;

  localStorage.removeItem(`user_module_pref_${userId}`);

  try {
    const prefRef = doc(db, 'users', userId, 'preferences', 'module');
    await setDoc(prefRef, { lastUsedModule: null }, { merge: true });

    const directRef = doc(db, 'users', userId);
    await setDoc(directRef, { lastUsedModule: null }, { merge: true });
  } catch (err) {
    console.warn('Firestore clear error for module preference:', err);
  }

  if (token) {
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ lastUsedModule: null })
      });
    } catch {
      // ignore
    }
  }
}
