import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  initializeFCM,
  markNotificationPromptShown,
  checkNotificationPromptShown,
  saveFcmTokenToFirestore,
  requestNotificationPermission,
  isIframeContext
} from '../fcm';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Bell, CheckCircle, ExternalLink, X } from 'lucide-react';

export const FleetNotificationPromptOverlay: React.FC = () => {
  const { user, token, role } = useAuth();

  const [permission, setPermission] = useState<string>('default');
  const [showOverlay, setShowOverlay] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDismissedSession, setIsDismissedSession] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('waybilla_notif_banner_dismissed') === 'true';
    }
    return false;
  });

  const userId = user?.id || user?.owner_phone || user?.phone_number || user?.phone || user?.customer_id;
  const userPhone = user?.phone_number || user?.phone || user?.owner_phone || '';

  const isDriver = role === 'driver' || user?.role === 'driver' || user?.manager_type === 'Driver';
  
  const isCapacitorOrNative =
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      (window as any).AndroidBridge !== undefined ||
      /Android/i.test(navigator.userAgent) ||
      document.URL.startsWith('capacitor://') ||
      document.URL.startsWith('http://localhost'));

  const isInIframe = !isCapacitorOrNative && isIframeContext();

  useEffect(() => {
    let isMounted = true;

    async function evaluateNotificationFlow() {
      if (!userId) {
        setShowOverlay(false);
        setShowBanner(false);
        return;
      }

      const currentPerm = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
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
          // SUBSEQUENT LOGINS or Drivers: Show small banner if not dismissed this session
          setShowOverlay(false);
          setShowBanner(!isDismissedSession);
        }
      }
    }

    evaluateNotificationFlow();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        evaluateNotificationFlow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', evaluateNotificationFlow);

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        evaluateNotificationFlow();
      }
    });

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', evaluateNotificationFlow);
      appStateListener.then((l) => l.remove()).catch(() => {});
    };
  }, [userId, token, isDriver, userPhone, isDismissedSession]);

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
      const result = await requestNotificationPermission(token || undefined, userId, userPhone);
      setPermission(result);

      if (result === 'granted') {
        setShowOverlay(false);
        setShowBanner(false);

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
      const result = await requestNotificationPermission(token || undefined, userId, userPhone);
      setPermission(result);

      if (result === 'granted') {
        setShowBanner(false);
        setToastMessage('✅ Push notifications enabled! You will receive instant phone alerts.');
        setTimeout(() => setToastMessage(null), 4500);
      } else if (result === 'denied') {
        setToastMessage('🔔 Push notifications are disabled in settings.');
        setTimeout(() => setToastMessage(null), 4000);
      }
    } catch (err) {
      console.error('Error enabling notifications from banner:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismissBanner = () => {
    setIsDismissedSession(true);
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('waybilla_notif_banner_dismissed', 'true');
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

      {/* PERSISTENT NON-OVERFLOWING CLEAN TOP BANNER */}
      {showBanner && !isDismissedSession && permission !== 'granted' && !showOverlay && (
        <div
          className="w-full max-w-full overflow-hidden bg-[#0c142b] border-b border-amber-500/30 text-amber-200 shadow-md relative z-40 px-3 sm:px-4 py-2"
          id="global-notification-banner"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2.5">
            {/* Left: Icon & Text */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
                <Bell className="w-3 h-3" />
              </div>
              <p className="text-[11px] sm:text-xs text-amber-100 font-medium leading-tight truncate">
                {permission === 'denied'
                  ? 'Push notifications are turned off. Enable to get instant alerts.'
                  : 'Enable notifications for real-time waybill & fleet tracking phone alerts.'}
              </p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isInIframe && (
                <button
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
                >
                  <span>Open Tab</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={handleEnableNowClick}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-lg text-[11px] transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                id="enable-now-banner-btn"
              >
                {loading ? '...' : 'Enable'}
              </button>
              <button
                onClick={handleDismissBanner}
                className="p-1 text-amber-300/70 hover:text-amber-100 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer"
                title="Dismiss"
                aria-label="Dismiss notification prompt"
                id="dismiss-notif-banner-btn"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

