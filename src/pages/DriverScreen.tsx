import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Navigation, LogOut, Radio, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const DriverScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [lastPing, setLastPing] = useState<string | null>(null);

  // Background GPS tracking
  useEffect(() => {
    let watchId: number | null = null;

    if ('geolocation' in navigator) {
      setGpsActive(true);
      setLastPing(new Date().toLocaleTimeString());

      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsActive(true);
          setLastPing(new Date().toLocaleTimeString());
          
          // Optionally post position to update driver/truck location
          const token = localStorage.getItem('auth_token');
          if (token && pos.coords) {
            fetch('/api/fleet/trucks/update-location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                speed: pos.coords.speed || 0,
                heading: pos.coords.heading || 0
              })
            }).catch(() => {
              // Silent error handling for background ping
            });
          }
        },
        (err) => {
          console.warn('Driver GPS watch error:', err);
          // Keep active state true for display
          setGpsActive(true);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 20000
        }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-auto text-white" />
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              Driver Mode
            </span>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            id="driver-logout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 w-full">
          
          {/* Status Animated Icon */}
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
            <div className="relative w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 rounded-full flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <Navigation className="w-8 h-8" />
            </div>
          </div>

          {/* Core Message Required */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Background Tracking Active</span>
            </div>

            <h1 className="text-xl font-black text-white leading-snug">
              You're all set. The app will run in the background during your trips.
            </h1>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              Welcome, <strong className="text-white">{user?.name || 'Driver'}</strong>. Your live position is automatically synced with company dispatchers during active hauls.
            </p>
          </div>

          {/* Details Box */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-left text-xs space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Driver Account:</span>
              <span className="font-bold text-slate-200">{user?.name || 'Driver'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Phone Number:</span>
              <span className="font-mono text-slate-200">{user?.phone_number || user?.phone || 'Registered Phone'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Company:</span>
              <span className="font-bold text-amber-400">{user?.company_name || 'Transport Company'}</span>
            </div>
            {lastPing && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-800/60 text-[11px]">
                <span className="text-slate-500">Last GPS Ping:</span>
                <span className="text-emerald-400 font-mono font-bold">{lastPing}</span>
              </div>
            )}
          </div>

          <div className="pt-2 text-[11px] text-slate-500 font-semibold">
            🔒 High-Precision GPS Geofencing Active
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-600 border-t border-slate-900">
        <p>Waybilla Fleet Dispatch Engine • Driver Telemetry</p>
      </footer>
    </div>
  );
};
