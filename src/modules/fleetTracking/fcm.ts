import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
        const event = new CustomEvent('fleet_foreground_notification', {
          detail: {
            title: payload.notification?.title || 'Fleet Alert 🚚',
            body: payload.notification?.body || '',
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
