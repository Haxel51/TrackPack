import React, { useState, useEffect } from 'react';
import { Share, X, PlusSquare } from 'lucide-react';

export const IosInstallBanner: React.FC = () => {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // 1. Check if user already dismissed banner
    const isDismissed = localStorage.getItem('trackpack_ios_pwa_dismissed');
    if (isDismissed === 'true') return;

    // 2. Detect iOS environment
    const userAgent = window.navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

    // 3. Detect if already running in standalone PWA mode
    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    // Only show if on iOS Safari and not in standalone mode
    if (isIos && !isStandalone) {
      setShowBanner(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('trackpack_ios_pwa_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto animate-slideUp">
      <div className="bg-[#0A1F44] border-2 border-[#F2A93B]/60 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F2A93B] text-[#0A1F44] flex items-center justify-center shrink-0 font-bold">
            📱
          </div>
          <div className="space-y-0.5">
            <p className="font-extrabold text-[#F2A93B] text-xs">Install TrackPack</p>
            <p className="text-slate-200 font-medium leading-tight">
              Tap the <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-300" /> Share icon below, then{' '}
              <strong className="text-white font-extrabold">'Add to Home Screen'</strong>{' '}
              <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-amber-300" />
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg bg-white/10 hover:bg-white/20 transition-all cursor-pointer shrink-0"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
