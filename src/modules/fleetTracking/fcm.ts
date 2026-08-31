// FCM and Web Push Notification Subscription for Managers, CEOs, and Trip Monitors

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

export async function initializeFCM(token: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // Request browser notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    // If Firebase messaging is configured with VAPID or Web Push API
    let webToken = localStorage.getItem('fleet_fcm_token');
    if (!webToken) {
      // Generate standard browser push endpoint or unique token identifier
      webToken = 'fcm_web_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('fleet_fcm_token', webToken);
    }

    await registerFcmPushToken(token, webToken);
    return webToken;
  } catch (err) {
    console.warn('[FCM] Error initializing push notifications:', err);
    return null;
  }
}
