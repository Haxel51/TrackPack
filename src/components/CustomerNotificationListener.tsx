import { useEffect, useRef, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store';
import { Waybill } from '../types';
import { getRouteTransitInfo } from '../lib/eta';
import { registerPushNotification } from '../lib/api';
import { triggerInAppNotificationToast } from './NotificationToast';

// Helper to get warm, human phrasing for shipment statuses
export function getWarmerStatusPhrase(
  status: string, 
  waybill: Waybill, 
  historicalAverageHours?: number,
  customDistanceKm?: number,
  completedTrips?: any[],
  initialEstimateHours?: number
): string {
  const origin = waybill.originPark || 'Origin Park';
  const destination = waybill.destinationPark || 'Destination Park';
  const bus = waybill.busNumber || 'the shuttle';
  
  if (status === 'Booked') {
    return `We've got your package! ${origin} is taking care of it.`;
  }
  if (status === 'Departed') {
    return `Your package just left ${origin}, riding on Bus ${bus}.`;
  }
  if (status === 'In Transit') {
    const routeInfo = getRouteTransitInfo(origin, destination, historicalAverageHours, customDistanceKm, completedTrips || [], initialEstimateHours);
    const departedTime = waybill.departedTimestamp || Date.now();
    const minEstMs = departedTime + (routeInfo.minDurationHours * 60 * 60 * 1000);
    const maxEstMs = departedTime + (routeInfo.maxDurationHours * 60 * 60 * 1000);
    const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const minRange = new Date(minEstMs);
    const maxRange = new Date(maxEstMs);
    const timeRange = `${formatTime(minRange)} and ${formatTime(maxRange)}`;
    const patternText = routeInfo.patternUsed ? ` (${routeInfo.patternUsed} pattern applied)` : '';
    const learnedLabel = routeInfo.isSelfLearned ? '✨ ' : '';
    return `On the way! ${learnedLabel}Expected between ${timeRange}${patternText}.`;
  }
  if (status === 'Arrived') {
    return `Good news — your package just reached ${destination}!`;
  }
  if (status === 'Collected') {
    return `Delivered! Your package made it safely. The receiver has collected it.`;
  }
  return status;
}

export function CustomerNotificationListener() {
  const { user } = useAuthStore();
  const previousStatusesRef = useRef<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);

  // Phone resolution from logged in user or stored phone session
  const activePhone = user?.phone || localStorage.getItem('tracked_phone') || localStorage.getItem('user_phone') || '';

  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  useEffect(() => {
    if (!activePhone) return;

    // Check if browser notification permission is default (not asked yet) or denied
    if ('Notification' in window && Notification.permission === 'default') {
      setShowPermissionBanner(true);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      registerPushNotification(activePhone).catch(() => {});
    }

    const senderQ = query(collection(db, 'waybills'), where('senderPhone', '==', activePhone));
    const receiverQ = query(collection(db, 'waybills'), where('receiverPhone', '==', activePhone));

    const handleWaybillsUpdate = (waybills: Waybill[]) => {
      if (isFirstLoadRef.current) {
        // Just populate previous statuses on first load so we don't trigger old notifications
        waybills.forEach((wb) => {
          if (wb.id && wb.status) {
            previousStatusesRef.current[wb.id] = wb.status;
          }
        });
        isFirstLoadRef.current = false;
        return;
      }

      waybills.forEach((wb) => {
        if (!wb.id || !wb.status) return;

        const prevStatus = previousStatusesRef.current[wb.id];
        const newStatus = wb.status;

        const isNewBooking = !prevStatus && (newStatus === 'Booked' || newStatus === 'Draft');
        if (isNewBooking || (prevStatus && prevStatus !== newStatus)) {
          const targetStatuses = ['Booked', 'Departed', 'In Transit', 'Arrived', 'Collected'];
          if (targetStatuses.includes(newStatus)) {
            const bodyText = getWarmerStatusPhrase(newStatus, wb);
            // 1. Always trigger instant live in-app notification toast with audio chime & vibration
            triggerInAppNotificationToast({
              title: isNewBooking ? `New Shipment Booked! #${wb.trackingCode || ''}` : `Shipment Status: ${newStatus}`,
              body: bodyText,
              type: 'info',
              trackingCode: wb.trackingCode
            });

            // 2. Trigger native OS desktop/mobile notification if permitted
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(isNewBooking ? "New TrackPack Shipment Booked" : "TrackPack Shipment Update", {
                  body: bodyText,
                  icon: "/favicon.ico"
                });
              } catch (err) {
                console.error("Failed to trigger OS Notification:", err);
              }
            }
          }
        }
        
        previousStatusesRef.current[wb.id] = newStatus;
      });
    };

    let senderWaybills: Waybill[] = [];
    let receiverWaybills: Waybill[] = [];

    const combineAndProcess = () => {
      const waybillsMap = new Map<string, Waybill>();
      senderWaybills.forEach(w => waybillsMap.set(w.id!, w));
      receiverWaybills.forEach(w => waybillsMap.set(w.id!, w));
      handleWaybillsUpdate(Array.from(waybillsMap.values()));
    };

    const unsubSender = onSnapshot(senderQ, (snap) => {
      senderWaybills = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill));
      combineAndProcess();
    }, (err) => {
      console.error("Sender notification stream error:", err);
    });

    const unsubReceiver = onSnapshot(receiverQ, (snap) => {
      receiverWaybills = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Waybill));
      combineAndProcess();
    }, (err) => {
      console.error("Receiver notification stream error:", err);
    });

    return () => {
      unsubSender();
      unsubReceiver();
    };
  }, [activePhone]);

  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted' && activePhone) {
          await registerPushNotification(activePhone);
          triggerInAppNotificationToast({
            title: 'Phone Notifications Enabled! 🔔',
            body: 'You will now receive instant alerts on your phone whenever your parcel moves or arrives.',
            type: 'success'
          });
        }
      } catch (err) {
        console.warn('Error requesting notification permission:', err);
      }
    }
    setShowPermissionBanner(false);
  };

  if (!showPermissionBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-40 max-w-md bg-navy text-white p-4 rounded-2xl shadow-2xl border border-amber/40 animate-slideUp flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber/20 text-amber-400 flex items-center justify-center shrink-0">
          🔔
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Enable Phone Notifications</h4>
          <p className="text-xs text-gray-300">Get instant alerts on your phone when your parcel is shipped or arrives at the park.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <button
          onClick={handleEnableNotifications}
          className="px-3.5 py-1.5 bg-amber hover:bg-amber-400 text-navy font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          Enable Alerts 🔔
        </button>
        <button
          onClick={() => setShowPermissionBanner(false)}
          className="text-gray-400 hover:text-white text-xs px-2 py-1"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
