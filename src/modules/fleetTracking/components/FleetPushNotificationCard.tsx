import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { initializeFCM, saveFcmTokenToFirestore } from '../fcm';
import { triggerOSNotification } from '../../../utils/notifications';
import { Bell, CheckCircle, AlertTriangle } from 'lucide-react';

export const FleetPushNotificationCard: React.FC = () => {
  const { user, token } = useAuth();
  const [permission, setPermission] = useState<string>('default');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userId = user?.id || user?.owner_phone || user?.phone_number || user?.phone;
  const userPhone = user?.phone_number || user?.phone || user?.owner_phone || '';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      if ('Notification' in window) {
        const result = await Notification.requestPermission();
        setPermission(result);

        if (result === 'granted' && userId) {
          const fcmTok = await initializeFCM(token || undefined, userId);
          if (fcmTok) {
            await saveFcmTokenToFirestore(userId, fcmTok, userPhone);
          }

          // Trigger immediate test notification into phone notification bar like Waybill does
          await triggerOSNotification('Fleet Tracking Alerts Active 🚛', {
            body: 'You will now receive real-time alerts about your trucks and drivers.',
            tag: 'fleet-welcome'
          });

          setToastMessage('✅ Push notifications enabled! Real-time fleet alerts are now active.');
          setTimeout(() => setToastMessage(null), 5000);
        }
      }
    } catch (err) {
      console.error('Error enabling notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableNotifications = () => {
    setPermission('default');
    setToastMessage('🔔 Push notifications turned off.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const isGranted = permission === 'granted';

  return (
    <div className={`rounded-3xl p-6 border transition-all shadow-xl ${
      isGranted
        ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-100'
        : 'bg-amber-950/20 border-amber-500/40 text-amber-100'
    }`} id="fleet-push-notification-card">
      
      {/* Toast Banner */}
      {toastMessage && (
        <div className="mb-4 bg-[#070b19] border border-emerald-500/60 text-emerald-300 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-lg">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        
        {/* Left Side: Status & Explanation */}
        <div className="flex items-start gap-4 min-w-0">
          <div className={`p-3.5 rounded-2xl shrink-0 ${
            isGranted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isGranted ? (
              <CheckCircle className="w-6 h-6 animate-pulse" />
            ) : (
              <Bell className="w-6 h-6 animate-bounce" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-black tracking-tight text-white">
                Fleet Push Notifications
              </h3>
              <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isGranted
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                {isGranted ? '✅ Push Alerts: ON' : '🔔 Push Alerts: OFF'}
              </span>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed font-normal max-w-2xl">
              {isGranted
                ? 'Instant real-time phone push alerts are active. You will receive notifications for truck dispatches, trip delays, speed violations, and geofence arrivals even when the app is closed.'
                : 'Enable notifications to receive instant phone alerts whenever trucks depart, arrive, enter geofences, or encounter delays.'}
            </p>
          </div>
        </div>

        {/* Right Side: Action Button */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          {!isGranted ? (
            <button
              onClick={handleEnableNotifications}
              disabled={loading}
              className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2 shrink-0"
              id="enable-fleet-push-card-btn"
            >
              <Bell className="w-4 h-4 fill-slate-950 shrink-0" />
              <span>{loading ? 'Requesting...' : 'Turn On Notifications'}</span>
            </button>
          ) : (
            <button
              onClick={handleDisableNotifications}
              className="w-full sm:w-auto bg-[#131e3d] hover:bg-slate-700 text-slate-200 border border-blue-900/65 font-bold px-5 py-2.5 rounded-2xl text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-2 shrink-0"
              id="disable-fleet-push-card-btn"
            >
              <span>Turn Off</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
