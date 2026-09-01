import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { triggerOSNotification } from '../../utils/notifications';

export async function markNotificationPromptShown(userId: string): Promise<void> {
  if (!userId) return;
  try {
    localStorage.setItem('fleet_notif_prompt_shown_' + userId, 'true');
    const userRef = doc(db, 'fleetTracking_users', userId);
    await setDoc(userRef, { notificationPromptShown: true, promptShownAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[FCM] Error marking prompt shown:', err);
  }
}

export async function checkNotificationPromptShown(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (localStorage.getItem('fleet_notif_prompt_shown_' + userId) === 'true') {
    return true;
  }
  try {
    const userRef = doc(db, 'fleetTracking_users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data()?.notificationPromptShown === true) {
      localStorage.setItem('fleet_notif_prompt_shown_' + userId, 'true');
      return true;
    }
  } catch (err) {
    console.warn('[FCM] Error checking prompt status in Firestore:', err);
  }
  return false;
}

export async function saveFcmTokenToFirestore(userId: string, fcmToken: string, userPhone?: string): Promise<void> {
  if (!userId || !fcmToken) return;
  try {
    const payload = {
      fcmToken,
      fcm_token: fcmToken,
      fcmTokenUpdatedAt: serverTimestamp(),
      updated_at: new Date().toISOString(),
      notificationPromptShown: true,
      notifications_enabled: true
    };

    // Save to fleetTracking_users
    try {
      const fleetRef = doc(db, 'fleetTracking_users', userId);
      await setDoc(fleetRef, payload, { merge: true });
    } catch (e) { /* ignore */ }

    // Save to users collection
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, payload, { merge: true });
    } catch (e) { /* ignore */ }

    // Save to customers collection
    try {
      const custRef = doc(db, 'customers', userId);
      await setDoc(custRef, payload, { merge: true });
    } catch (e) { /* ignore */ }

    // Save to managers collection
    try {
      const mgrRef = doc(db, 'managers', userId);
      await setDoc(mgrRef, payload, { merge: true });
    } catch (e) { /* ignore */ }

    // Save to device_tokens collection for quick phone lookup
    if (userPhone) {
      try {
        const devTokenRef = doc(db, 'device_tokens', `${userId}_${fcmToken.substring(0, 10)}`);
        await setDoc(devTokenRef, {
          customer_id: userId,
          user_id: userId,
          phone_number: userPhone,
          token: fcmToken,
          created_at: new Date().toISOString()
        }, { merge: true });
      } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.warn('[FCM] Error saving fcmToken to Firestore:', err);
  }
}

export async function registerFcmPushToken(token: string, fcmToken: string): Promise<boolean> {
  if (!token || !fcmToken) return false;
  try {
    const res = await fetch('/api/fleet-tracking/fcm-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fcmToken })
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch (err) {
    console.warn('[FCM] Failed to register FCM token with server:', err);
    return false;
  }
}

let messagingInstance: any = null;

async function getMessagingSafe() {
  if (messagingInstance) return messagingInstance;
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (e) {
    console.warn('[FCM] Messaging not supported:', e);
  }
  return null;
}

export async function initializeFCM(token?: string, currentUserId?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const messaging = await getMessagingSafe();
    let fcmToken: string | null = null;

    const vapidKey = (import.meta as any).env?.VITE_VAPID_KEY;

    if (messaging) {
      try {
        let swReg: ServiceWorkerRegistration | undefined = undefined;
        if ('serviceWorker' in navigator) {
          try {
            swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          } catch (swErr) {
            console.warn('[FCM] SW registration warn:', swErr);
          }
        }
        fcmToken = await getToken(messaging, {
          ...(swReg ? { serviceWorkerRegistration: swReg } : {}),
          ...(vapidKey ? { vapidKey } : {})
        });
      } catch (err) {
        console.warn('[FCM] getToken error:', err);
      }
    }

    if (!fcmToken) {
      fcmToken = localStorage.getItem('fleet_fcm_token');
      if (!fcmToken) {
        fcmToken = 'fcm_web_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('fleet_fcm_token', fcmToken);
      }
    }

    if (token && fcmToken) {
      await registerFcmPushToken(token, fcmToken);
    }

    if (currentUserId && fcmToken) {
      try {
        const userRef = doc(db, 'fleetTracking_users', currentUserId);
        await updateDoc(userRef, {
          fcmToken,
          fcmTokenUpdatedAt: serverTimestamp()
        });
      } catch (e) {
        try {
          const mgrRef = doc(db, 'managers', currentUserId);
          await updateDoc(mgrRef, {
            fcmToken,
            fcmTokenUpdatedAt: serverTimestamp()
          });
        } catch (err) {
          console.warn('[FCM] Firestore user token update error:', err);
        }
      }
    }

    if (messaging) {
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        const title = payload.notification?.title || 'Fleet Alert 🚛';
        const body = payload.notification?.body || '';
        triggerOSNotification(title, {
          body,
          data: payload.data || {}
        });

        const event = new CustomEvent('fleet_foreground_notification', {
          detail: {
            title,
            body,
            data: payload.data || {}
          }
        });
        window.dispatchEvent(event);
      });
    }

    return fcmToken;
  } catch (err) {
    console.error('[FCM] FCM init error:', err);
    return null;
  }
}

export function isIframeContext(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export async function requestNotificationPermission(token?: string, currentUserId?: string): Promise<NotificationPermission | 'unsupported' | 'iframe_blocked'> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('Browser does not support notifications');
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      await initializeFCM(token, currentUserId);
      return 'granted';
    }

    if (isIframeContext()) {
      console.warn('[FCM] Inside iframe context. Browsers block Notification.requestPermission in cross-origin iframes.');
      return 'iframe_blocked';
    }

    if (Notification.permission === 'denied') {
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await initializeFCM(token, currentUserId);
    }
    return permission;
  } catch (error) {
    console.error('Notification permission error:', error);
    if (isIframeContext()) {
      return 'iframe_blocked';
    }
    return 'denied';
  }
}
