import { triggerOSNotification } from '../utils/notifications';
import { requestNotificationPermission as unifiedRequestPermission } from '../modules/fleetTracking/fcm';

// Notification helper for in-app and browser/native push notifications
export function requestNotificationPermission(token?: string, userId?: string, userPhone?: string) {
  return unifiedRequestPermission(token, userId, userPhone);
}

export function sendBrowserNotification(title: string, options?: NotificationOptions) {
  return triggerOSNotification(title, {
    body: options?.body,
    icon: options?.icon || '/icon-192.png',
    badge: options?.badge || '/icon-192.png',
    tag: options?.tag,
    data: options?.data
  });
}
