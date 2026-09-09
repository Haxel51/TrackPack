import React, { useState, useEffect } from 'react';
import { Bell, ExternalLink, X, Settings2, ShieldCheck, ArrowRight } from 'lucide-react';
import { openAppNotificationSettings } from '../modules/fleetTracking/fcm';

export const AndroidNotificationGuideModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);

    window.addEventListener('waybilla_show_android_notif_guide', handleOpen);
    window.addEventListener('waybilla_hide_android_notif_guide', handleClose);

    return () => {
      window.removeEventListener('waybilla_show_android_notif_guide', handleOpen);
      window.removeEventListener('waybilla_hide_android_notif_guide', handleClose);
    };
  }, []);

  if (!isOpen) return null;

  const handleOpenSettings = () => {
    openAppNotificationSettings();
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-[#070b19]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-[#0b1329] border border-blue-900/50 rounded-3xl max-w-sm w-full p-6 text-white space-y-5 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          aria-label="Close"
          id="close-android-guide-btn"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Bell Icon Header */}
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-emerald-400">
          <Bell className="w-8 h-8 animate-bounce" />
        </div>

        {/* Title & Instructions */}
        <div className="text-center space-y-2">
          <h3 className="text-lg font-black tracking-tight text-white">
            Enable Notifications
          </h3>
          <p className="text-xs text-slate-300 font-normal leading-relaxed">
            To receive real-time fleet & waybill alerts on this device:
          </p>
        </div>

        {/* 4-Step Instructions Card */}
        <div className="bg-[#0f1b3b]/80 border border-blue-900/40 rounded-2xl p-4 text-xs space-y-2.5 text-slate-200">
          <div className="flex items-start gap-2.5">
            <span className="bg-emerald-500/20 text-emerald-300 font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px] mt-0.5">
              1
            </span>
            <span className="leading-snug">
              Tap <strong className="text-emerald-300 font-bold">'Open Settings'</strong> below
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="bg-emerald-500/20 text-emerald-300 font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px] mt-0.5">
              2
            </span>
            <span className="leading-snug">
              Tap <strong className="text-white font-bold">'Notifications'</strong>
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="bg-emerald-500/20 text-emerald-300 font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px] mt-0.5">
              3
            </span>
            <span className="leading-snug">
              Toggle <strong className="text-emerald-300 font-bold">'Show notifications'</strong> ON
            </span>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="bg-emerald-500/20 text-emerald-300 font-black rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[11px] mt-0.5">
              4
            </span>
            <span className="leading-snug">
              Come back to the Waybilla app
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          <button
            onClick={handleOpenSettings}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-black py-3 px-5 rounded-2xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2"
            id="open-settings-android-btn"
          >
            <Settings2 className="w-4 h-4" />
            <span>Open Settings</span>
          </button>

          <button
            onClick={handleDismiss}
            className="w-full text-slate-400 hover:text-slate-200 text-xs py-2 text-center transition-colors cursor-pointer font-medium"
            id="dismiss-android-guide-btn"
          >
            I'll do it later
          </button>
        </div>
      </div>
    </div>
  );
};
