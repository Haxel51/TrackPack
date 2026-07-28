import { useState, useEffect } from 'react';
import { Bell, CheckCircle2, X, Sparkles } from 'lucide-react';
import { Button } from './ui';
import { registerPushNotification } from '../lib/api';

export interface ToastPayload {
  id?: string;
  title: string;
  body: string;
  type?: 'info' | 'success' | 'warning';
  trackingCode?: string;
  url?: string;
}

// Web Audio API chime generator for pleasant notification sound
export function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Suppress audio context block if user hasn't interacted with page
  }
}

export function triggerInAppNotificationToast(payload: ToastPayload) {
  playNotificationChime();
  const event = new CustomEvent('trackpack_notification_toast', {
    detail: { ...payload, id: payload.id || `toast_${Date.now()}` }
  });
  window.dispatchEvent(event);
}

export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<ToastPayload>;
      if (customEvent.detail) {
        setToasts(prev => [customEvent.detail, ...prev.slice(0, 2)]);
      }
    };

    window.addEventListener('trackpack_notification_toast', handleEvent);
    return () => window.removeEventListener('trackpack_notification_toast', handleEvent);
  }, []);

  const removeToast = (id?: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 max-w-md w-full space-y-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-navy text-white p-4 rounded-2xl shadow-2xl border border-white/20 transform transition-all duration-300 animate-in fade-in slide-in-from-top-4 flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> TrackPack Live Notification
              </span>
              <span className="text-[10px] text-gray-300 bg-white/10 px-1.5 py-0.5 rounded">Just now</span>
            </div>
            <h4 className="text-sm font-bold text-white mt-0.5">{toast.title}</h4>
            <p className="text-xs text-gray-200 mt-1 leading-relaxed">{toast.body}</p>

            {toast.trackingCode && (
              <div className="mt-2.5 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = `/track/${toast.trackingCode}`;
                  }}
                  className="bg-emerald-500 hover:bg-emerald-600 text-navy font-bold text-xs py-1 h-7 rounded-lg"
                >
                  View Shipment
                </Button>
              </div>
            )}
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Production Push Notification Registration Card Component
export function PushNotificationTesterCard({
  phone,
  trackingCode
}: {
  phone?: string;
  trackingCode?: string;
  compact?: boolean;
}) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [pushActive, setPushActive] = useState<boolean>(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    } else {
      setPermission('unsupported');
    }

    if (phone) {
      const clean = phone.replace(/[^0-9]/g, '');
      const localPref = localStorage.getItem(`push_pref_${clean}`);
      if (localPref === 'true') {
        setPushActive(true);
      }
    }
  }, [phone]);

  const handleEnablePush = async () => {
    if (!phone) {
      alert("No phone number specified to register notifications.");
      return;
    }

    // 1. Request OS permission if available
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermission(perm);
      } catch (e) {
        console.warn('Permission request error:', e);
      }
    }

    // 2. Register push preference and service worker
    try {
      const ok = await registerPushNotification(phone);
      if (ok) {
        setPushActive(true);
        triggerInAppNotificationToast({
          title: "Notifications Activated! 🔔",
          body: "You are now registered for live shipment updates via in-app banners & device push alerts.",
          type: 'success'
        });
      }
    } catch (e) {
      console.error('Failed to register push:', e);
    }
  };

  return (
    <div className="bg-gradient-to-r from-navy/5 via-blue-50 to-indigo-50 border border-navy/15 p-4 md:p-5 rounded-2xl shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-navy">Live Status Bar Notifications</h4>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                pushActive 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                <CheckCircle2 className="w-3 h-3" />
                {pushActive ? 'Active & Monitoring' : 'Tap to Enable'}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Receive automatic alerts on your phone status bar when your waybill is <strong>Booked</strong>, <strong>Departed</strong>, <strong>In Transit</strong>, <strong>Arrived</strong>, or <strong>Collected</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <Button
            size="sm"
            onClick={handleEnablePush}
            className="bg-navy hover:bg-navy-light text-white text-xs font-bold px-3.5 py-2 h-9 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5" />
            {pushActive ? '✓ Notifications Active' : 'Enable Live Alerts'}
          </Button>
        </div>
      </div>
    </div>
  );
}
