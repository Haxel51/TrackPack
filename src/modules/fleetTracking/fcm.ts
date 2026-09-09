import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { triggerOSNotification } from '../../utils/notifications';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

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

export function checkIsAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  
  const isPluginAvailable = Capacitor.isPluginAvailable('PushNotifications');
  if (isPluginAvailable) return true;

  const ua = navigator.userAgent || '';
  const isAndroidByUA = /Android/i.test(ua) && !/Chrome/i.test(ua);
  const isAndroidCustomUA = ua.includes('Waybilla') || ua.includes('wv') || (window as any).Android !== undefined;
  const isCapacitorUrl = document.URL.startsWith('capacitor://') || document.URL.startsWith('http://localhost');
  const isCapacitorOverride = (window as any).__CAPACITOR_PLATFORM__ === 'android';
  const isCapacitorNative = Capacitor.isNativePlatform();

  const isWv = isCapacitorNative || (isPluginAvailable && (isAndroidByUA || isAndroidCustomUA || isCapacitorUrl || isCapacitorOverride));

  console.log('[Platform Detection Method]', {
    isWvResult: isWv,
    isPluginAvailable,
    isCapacitorNative,
    isAndroidByUA,
    isAndroidCustomUA,
    isCapacitorUrl,
    isCapacitorOverride,
    userAgent: ua,
    currentUrl: document.URL
  });

  return isWv;
}

let pushListenersInitialized = false;

export function setupCapacitorPushListeners(currentUserId?: string, userPhone?: string, authToken?: string) {
  if (!Capacitor.isPluginAvailable('PushNotifications') || pushListenersInitialized) return;
  pushListenersInitialized = true;

  try {
    // 1. On Push Registration Success
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Native Push] FCM Token received:', token.value);
      if (token.value) {
        localStorage.setItem('fleet_fcm_token', token.value);
        if (currentUserId) {
          await saveFcmTokenToFirestore(currentUserId, token.value, userPhone);
        }
        if (authToken) {
          await registerFcmPushToken(authToken, token.value);
        }
      }
    });

    // 2. On Registration Error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[Native Push] Registration error:', error);
    });

    // 3. On Foreground Push Received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Native Push] Push notification received in foreground:', notification);
      const title = notification.title || 'Waybilla Alert 🚛';
      const body = notification.body || '';
      triggerOSNotification(title, {
        body,
        data: notification.data || {}
      });

      const event = new CustomEvent('fleet_foreground_notification', {
        detail: {
          title,
          body,
          data: notification.data || {}
        }
      });
      window.dispatchEvent(event);
    });

    // 4. On Push Notification Action Performed (Notification tapped)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Native Push] Push notification tapped:', action);
      const data = action.notification?.data || {};
      const targetUrl = data.url || data.link;
      const tripId = data.tripId || data.trip_id;
      const waybillNumber = data.waybillNumber || data.waybill_number || data.waybillId || data.waybill_id;

      if (typeof window !== 'undefined') {
        if (targetUrl) {
          window.location.href = targetUrl;
        } else if (tripId) {
          window.location.href = `/fleet-tracking/trip/${tripId}`;
        } else if (waybillNumber) {
          window.location.href = `/customer`;
        }
      }
    });
  } catch (err) {
    console.warn('[Native Push] Listener setup error:', err);
  }
}

export function showAndroidNotificationGuide() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waybilla_show_android_notif_guide'));
  }
}

export function hideAndroidNotificationGuide() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('waybilla_hide_android_notif_guide'));
  }
}

export function openAppNotificationSettings() {
  if (typeof window !== 'undefined') {
    if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.openNotificationSettings === 'function') {
      try {
        (window as any).AndroidBridge.openNotificationSettings();
        return;
      } catch (e) {
        console.warn('[AndroidBridge] openNotificationSettings error:', e);
      }
    }

    try {
      window.location.href = 'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;pkg=com.waybilla.app;end';
    } catch (e) {
      try {
        window.location.href = 'app-settings:com.waybilla.app';
      } catch (err) {
        console.warn('Could not open settings via scheme:', err);
      }
    }
  }
}

export function checkIsAndroidAPK(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /wv/.test(navigator.userAgent) ||
    /Android.*Version\/[0-9.]+/i.test(navigator.userAgent) ||
    (window as any).AndroidBridge !== undefined ||
    Capacitor.isNativePlatform()
  );
}

export async function requestNotificationPermission(
  token?: string,
  currentUserId?: string,
  userPhone?: string
): Promise<NotificationPermission | 'unsupported' | 'iframe_blocked'> {
  try {
    const isAndroidAPK = checkIsAndroidAPK();

    // 0. Dedicated Android APK Flow
    if (isAndroidAPK) {
      console.log('[Push] Android APK detected. Checking permission status...');

      let isGranted = false;
      if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.areNotificationsEnabled === 'function') {
        try {
          isGranted = (window as any).AndroidBridge.areNotificationsEnabled();
        } catch (e) {
          isGranted = false;
        }
      } else if (typeof window !== 'undefined' && 'Notification' in window) {
        isGranted = Notification.permission === 'granted';
      }

      if (isGranted) {
        console.log('[Push] Notifications already enabled on Android APK');
        if (currentUserId) {
          const payload = {
            notificationsEnabled: true,
            notificationPlatform: 'android-apk',
            notificationsEnabledAt: serverTimestamp(),
            notificationPromptShown: true,
            updated_at: new Date().toISOString()
          };
          try {
            await setDoc(doc(db, 'fleetTracking_users', currentUserId), payload, { merge: true });
          } catch (e) { /* ignore */ }
          try {
            await setDoc(doc(db, 'users', currentUserId), payload, { merge: true });
          } catch (e) { /* ignore */ }
          await initializeFCM(token, currentUserId);
        }
        return 'granted';
      } else {
        console.log('[Push] Notifications not enabled on APK. Showing in-app guide...');
        showAndroidNotificationGuide();
        return 'denied';
      }
    }

    // 1. Standard Web Browser / PWA handling
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

    // Wrap Notification.requestPermission in a 5s race timeout so WebView never hangs loading forever
    const permPromise = Notification.requestPermission();
    const timeoutPromise = new Promise<NotificationPermission>((resolve) => {
      setTimeout(() => resolve((Notification.permission as NotificationPermission) || 'denied'), 5000);
    });

    const permission = await Promise.race([permPromise, timeoutPromise]);
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
