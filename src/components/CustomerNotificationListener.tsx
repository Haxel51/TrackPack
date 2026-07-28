import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!user?.phone || user.role !== 'customer') return;

    const phone = user.phone;

    // Automatically attempt service worker push registration in background
    registerPushNotification(phone).catch(() => {});

    // Check if notifications are enabled
    const isPushEnabled = () => {
      const localPref = localStorage.getItem(`push_pref_${phone}`);
      return localPref === 'true' && 'Notification' in window && Notification.permission === 'granted';
    };

    const senderQ = query(collection(db, 'waybills'), where('senderPhone', '==', phone));
    const receiverQ = query(collection(db, 'waybills'), where('receiverPhone', '==', phone));

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
            // 1. Always trigger instant live in-app notification toast with audio chime
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
  }, [user?.phone, user?.role]);

  return null;
}
