import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnectedBanner, setShowReconnectedBanner] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedBanner(true);
      const timer = setTimeout(() => setShowReconnectedBanner(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedBanner(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnectedBanner) {
    return null;
  }

  return (
    <div className={`w-full py-2 px-4 text-xs font-medium text-center flex items-center justify-center gap-2 transition-colors duration-300 ${
      !isOnline 
        ? 'bg-amber-500 text-white shadow-inner' 
        : 'bg-emerald-600 text-white'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
          <span>Network connection lost or unstable. TrackPack will auto-sync when network returns.</span>
          <button 
            onClick={() => window.location.reload()} 
            className="ml-2 bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Internet connection restored! Syncing latest waybills...</span>
        </>
      )}
    </div>
  );
}
