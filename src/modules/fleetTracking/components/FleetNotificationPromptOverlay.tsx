import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  initializeFCM,
  markNotificationPromptShown,
  checkNotificationPromptShown,
  saveFcmTokenToFirestore,
  isIframeContext
} from '../fcm';
import { Bell, CheckCircle, ExternalLink } from 'lucide-react';

export const FleetNotificationPromptOverlay: React.FC = () => {
  const { user, token, role } = useAuth();

  const [permission, setPermission] = useState<string>('default');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const userId = user?.id || user?.owner_phone || user?.phone_number || user?.phone || user?.customer_id;
  const userPhone = user?.phone_number || user?.phone || user?.owner_phone || '';

  const isDriver = role === 'driver' || user?.role === 'driver' || user?.manager_type === 'Driver';
  const isInIframe = isIframeContext();

  useEffect(() => {
    let isMounted = true;

    async function evaluateNotificationFlow() {
      if (!userId) {
        setShowOverlay(false);
        setShowBanner(false);
        return;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPermission('unsupported');
        return;
      }

      const currentPerm = Notification.permission;
      if (isMounted) {
        setPermission(currentPerm);
      }

      // If permission is already granted, initialize FCM silently & update token
      if (currentPerm === 'granted') {
        setShowOverlay(false);
        setShowBanner(false);
        const fcmTok = await initializeFCM(token || undefined, userId);
        if (fcmTok) {
          await saveFcmTokenToFirestore(userId, fcmTok, userPhone);
        }
        return;
      }

      // Permission is 'default' or 'denied'
      const promptShown = await checkNotificationPromptShown(userId);

      if (isMounted) {
        if (!promptShown && !isDriver) {
          // FIRST LOGIN ONLY for Managers/CEO/Customers/Staff: Show full screen overlay
          setShowOverlay(true);
          setShowBanner(false);
        } else {
          // SUBSEQUENT LOGINS or Drivers: Show small banner
          setShowOverlay(false);
          setShowBanner(true);
        }
      }
    }

    evaluateNotificationFlow();

    return () => {
      isMounted = false;
    };
  }, [userId, token, isDriver, userPhone]);

  // Handle "Allow Notifications" button click on the Overlay
  const handleAllowClick = async () => {
    if (!userId) return;
    setLoading(true);

    await markNotificationPromptShown(userId);

    if (isInIframe) {
      window.open(window.location.href, '_blank');
      setLoading(false);
      setShowOverlay(false);
      setShowBanner(true);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setShowOverlay(false);
        setShowBanner(false);

        const fcmTok = await initializeFCM(token || undefined, userId);
        if (fcmTok) {
          await saveFcmTokenToFirestore(userId, fcmTok, userPhone);
        }

        setToastMessage('✅ Push notifications enabled! You will receive instant phone alerts.');
        setTimeout(() => setToastMessage(null), 4500);
      } else {
        setShowOverlay(false);
        setShowBanner(true);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setShowOverlay(false);
      setShowBanner(true);
    } finally {
      setLoading(false);
    }
  };

  const handleMaybeLaterClick = async () => {
    if (userId) {
      await markNotificationPromptShown(userId);
    }
    setShowOverlay(false);
    setShowBanner(true);
  };

  const handleEnableNowClick = async () => {
    if (!userId) return;
    setLoading(true);

    if (isInIframe) {
      window.open(window.location.href, '_blank');
      setLoading(false);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setShowBanner(false);
        const fcmTok = await initializeFCM(token || undefined, userId);
        if (fcmTok) {
          await saveFcmTokenToFirestore(userId, fcmTok, userPhone);
        }
        setToastMessage('✅ Push notifications enabled! You will receive instant phone alerts.');
        setTimeout(() => setToastMessage(null), 4500);
      }
    } catch (err) {
      console.error('Error enabling notifications from banner:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[10000] max-w-md bg-emerald-950 border border-emerald-500/70 text-emerald-100 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-xs font-bold">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FULL SCREEN OVERLAY / MODAL (FIRST LOGIN ONLY) */}
      {showOverlay && (
        <div className="fixed inset-0 z-[9999] bg-[#070b19]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl max-w-sm w-full p-8 text-center text-white space-y-6 shadow-2xl relative">
            {/* Bell Icon Header */}
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-400">
              <Bell className="w-10 h-10 animate-bounce" />
            </div>

            {/* Title & Description */}
            <div className="space-y-3">
              <h2 className="text-xl font-black tracking-tight text-white leading-snug">
                Stay Updated on Waybills & Fleet
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed font-normal px-1">
                Allow notifications to receive instant push alerts on your phone whenever your shipment status changes or fleet updates occur — even when the app is closed.
              </p>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={handleAllowClick}
                disabled={loading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black py-3.5 px-6 rounded-2xl text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
                id="allow-notifications-overlay-btn"
              >
                {loading ? (
                  <span className="animate-pulse">Requesting...</span>
                ) : (
                  <>
                    <Bell className="w-4 h-4 fill-slate-950 shrink-0" />
                    <span>Allow Notifications</span>
                  </>
                )}
              </button>

              <button
                onClick={handleMaybeLaterClick}
                disabled={loading}
                className="text-slate-400 hover:text-slate-200 text-xs py-2 w-full text-center transition-colors cursor-pointer font-medium"
                id="maybe-later-overlay-btn"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PERSISTENT SMALL YELLOW BANNER AT TOP OF DASHBOARD */}
      {showBanner && permission !== 'granted' && !showOverlay && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-3 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-200 shadow-sm relative z-40">
          <div className="flex items-center gap-2.5 min-w-0">
            <Bell className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
            <span className="font-semibold leading-relaxed truncate">
              {permission === 'denied'
                ? '🔔 Push notifications blocked. You may miss real-time waybill and fleet alerts.'
                : '🔔 Enable notifications to get real-time phone alerts for waybills & fleet'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isInIframe && (
              <button
                onClick={() => window.open(window.location.href, '_blank')}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
              >
                <span>🚀 Open in New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleEnableNowClick}
              disabled={loading}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
              id="enable-now-banner-btn"
            >
              {loading ? 'Requesting...' : 'Enable Now'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
