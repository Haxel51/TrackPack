import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) {
    return null;
  }

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-full shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all duration-300 ease-in-out ${
        isOffline
          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-amber-500/20 animate-bounce-short'
          : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
      }`}
      role="status"
      aria-live="polite"
    >
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4 shrink-0 text-slate-950 animate-pulse" />
          <span>You are currently offline. Check connection.</span>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin opacity-80 ml-1" />
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4 shrink-0 text-white" />
          <span>Internet connection restored</span>
        </>
      )}
    </div>
  );
};
