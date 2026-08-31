import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { initializeFCM, isIframeContext } from '../modules/fleetTracking/fcm';
import { Bell, BellOff, ExternalLink, X, CheckCircle, ShieldAlert, Smartphone } from 'lucide-react';

export const GlobalNotificationPrompt: React.FC = () => {
  const { token, user } = useAuth();
  const [permission, setPermission] = useState<string>('default');
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isInIframe = isIframeContext();

  // iOS Safari non-PWA check
  const isIos = typeof window !== 'undefined' && 
    /iPad|iPhone|iPod/.test(navigator.userAgent || '') && 
    !(window as any).MSStream;
  
  const isStandalone = typeof window !== 'undefined' && (
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );

  const isIosNonPwa = isIos && !isStandalone;

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }
  }, []);

  // Sync token initialization if permission is already granted
  useEffect(() => {
    if (permission === 'granted' && token) {
      initializeFCM(token, user?.id || user?.owner_phone);
    }
  }, [permission, token, user?.id, user?.owner_phone]);

  // If permission is already granted or dismissed for session, hide banner
  if (permission === 'granted' || dismissed) {
    return (
      <>
        {toastMessage && (
          <div className="fixed top-4 right-4 z-50 max-w-sm bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in text-xs">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  // Handle direct click gesture for Notification permission
  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setToastMessage('Browser does not support Web Push notifications.');
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    if (isInIframe) {
      window.open(window.location.href, '_blank');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        setToastMessage('Notifications enabled! You will now receive real-time alerts.');
        setTimeout(() => setToastMessage(null), 4000);
        if (token) {
          await initializeFCM(token, user?.id || user?.owner_phone);
        }
      } else if (result === 'denied') {
        setShowModal(true);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      setShowModal(true);
    }
  };

  return (
    <>
      {/* Top Banner for Notification Permission */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 px-4 py-2.5 shadow-md relative z-40 flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1 bg-slate-950/10 rounded-lg shrink-0">
            <Bell className="w-4 h-4 text-slate-950 animate-bounce" />
          </div>
          <span className="truncate leading-tight font-bold">
            {isInIframe ? (
              '🔔 Notification popups are blocked inside preview frames. Open in new tab to enable alerts.'
            ) : isIosNonPwa ? (
              '📱 iOS Web Push requires adding Waybilla to your Home Screen first.'
            ) : permission === 'denied' ? (
              '⚠️ Push notifications are blocked by browser settings. Tap Help to enable.'
            ) : (
              '🔔 Enable real-time push notifications for instant shipment & trip alerts.'
            )}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isInIframe ? (
            <button
              onClick={() => window.open(window.location.href, '_blank')}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <span>🚀 Open in New Tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          ) : isIosNonPwa ? (
            <button
              onClick={() => setToastMessage('Tap the Share icon in Safari, then "Add to Home Screen"')}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>How to Install</span>
            </button>
          ) : permission === 'denied' ? (
            <button
              onClick={() => setShowModal(true)}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95"
            >
              Help & Settings
            </button>
          ) : (
            <button
              onClick={handleRequestPermission}
              className="bg-slate-950 hover:bg-slate-900 text-amber-300 font-extrabold px-4 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Allow Notifications</span>
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="text-slate-950/70 hover:text-slate-950 p-1 rounded-lg transition-all cursor-pointer"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal when Permission is Denied */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-extrabold text-sm">How to Unblock Notifications</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                Your device or browser is currently blocking notification prompts for Waybilla. Follow these steps to allow real-time notifications:
              </p>
              
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-slate-200">
                <div className="font-bold text-amber-400 text-xs">📱 Android / Chrome PWA:</div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-300">
                  <li>Tap the <strong>🔒 Lock icon</strong> or <strong>Site Settings icon</strong> next to the URL or app title.</li>
                  <li>Tap <strong>Permissions</strong> → <strong>Notifications</strong>.</li>
                  <li>Change from <em>Blocked</em> to <strong>Allow</strong>.</li>
                </ol>

                <div className="font-bold text-amber-400 text-xs pt-2">🍎 iOS (iPhone PWA):</div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-300">
                  <li>Open iPhone <strong>Settings</strong> → <strong>Notifications</strong>.</li>
                  <li>Scroll to <strong>Waybilla</strong> and switch <strong>Allow Notifications</strong> ON.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setShowModal(false);
                  handleRequestPermission();
                }}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                Retry Notification Check
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
