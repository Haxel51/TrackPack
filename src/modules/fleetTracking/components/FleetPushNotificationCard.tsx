import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { requestNotificationPermission, hideAndroidNotificationGuide, checkRealNotificationStatus } from '../fcm';
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
    const checkState = async () => {
      const isGranted = await checkRealNotificationStatus();
      setPermission(isGranted ? 'granted' : (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'));
      if (isGranted) {
        hideAndroidNotificationGuide();
      }
    };

    checkState();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const isGranted = await checkRealNotificationStatus();
        if (isGranted) {
          setPermission('granted');
          hideAndroidNotificationGuide();
          setToastMessage('✅ Notifications enabled! You will now receive fleet alerts.');
          setTimeout(() => setToastMessage(null), 5000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkState);
    };
  }, []);

  const handleEnableNotifications = async () => {
    setLoading(true);
    try {
      const result = await requestNotificationPermission(token || undefined, userId, userPhone);
      setPermission(result);

      if (result === 'granted') {
        // Trigger immediate test notification into phone notification bar like Waybill does
        await triggerOSNotification('Fleet Tracking Alerts Active 🚛', {
          body: 'You will now receive real-time alerts about your trucks and drivers.',
          tag: 'fleet-welcome'
        });

        setToastMessage('✅ Notifications are already enabled! You will receive fleet alerts.');
        setTimeout(() => setToastMessage(null), 5000);
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
    <div className={`rounded-3xl p-5 border transition-all shadow-xs ${
      isGranted
        ? 'bg-white border-emerald-200 text-slate-900'
        : 'bg-white border-orange-200 text-slate-900'
    }`} id="fleet-push-notification-card">
      
      {/* Toast Banner */}
      {toastMessage && (
        <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        {/* Left Side: Status & Explanation */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className={`p-3 rounded-2xl shrink-0 ${
            isGranted ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-orange-50 text-orange-600 border border-orange-200'
          }`}>
            {isGranted ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <Bell className="w-5 h-5 text-orange-600" />
            )}
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-slate-900">
                Fleet Tracking Push Alerts
              </h3>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isGranted
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-orange-50 border-orange-200 text-orange-700'
              }`}>
                {isGranted ? '✓ Push Alerts: Active' : '🔔 Alerts: Off'}
              </span>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium max-w-2xl">
              {isGranted
                ? 'Real-time phone notifications are active for dispatches, trip delays, speed warnings, tamper sensor alarms, and geofence arrivals.'
                : 'Turn on notifications to receive instant phone alerts whenever assets depart, arrive, enter geofences, or trigger tamper sensors.'}
            </p>
          </div>
        </div>

        {/* Right Side: Action Button */}
        <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
          {!isGranted ? (
            <button
              onClick={handleEnableNotifications}
              disabled={loading}
              className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-black px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2 shrink-0"
              id="enable-fleet-push-card-btn"
            >
              <Bell className="w-4 h-4 text-white shrink-0" />
              <span>{loading ? 'Requesting...' : 'Turn On Alerts'}</span>
            </button>
          ) : (
            <button
              onClick={handleDisableNotifications}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Manage
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
