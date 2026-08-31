import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Settings, LogOut } from 'lucide-react';
import { getDriverActiveTrip } from '../modules/fleetTracking/api';
import {
  sendLocationWithRetry,
  flushPendingLocations,
} from '../modules/fleetTracking/offlineLocationSync';

function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const DriverScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const [permissionState, setPermissionState] = useState<'prompting' | 'allow_all' | 'allow_while_using' | 'denied'>('prompting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  const activeTripIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isHighAccuracyRef = useRef<boolean>(true);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const noTripTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tripCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const companyName = user?.company_name || 'Transport Company';
  const driverName = user?.name || 'Driver';
  const plateNumber = (user as any)?.plate_number || 'Truck Plate';

  // FIX 3: Wake Lock API request and release helpers
  const requestWakeLock = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator && (navigator as any).wakeLock) {
        if (!wakeLockRef.current) {
          const lock = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current = lock;
          lock.addEventListener('release', () => {
            wakeLockRef.current = null;
            if (typeof document !== 'undefined' && document.visibilityState === 'visible' && permissionState === 'allow_all') {
              requestWakeLock();
            }
          });
        }
      }
    } catch {
      // Silent fail - not all browsers or battery saver modes permit wake lock
    }
  }, [permissionState]);

  const releaseWakeLock = useCallback(async () => {
    try {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (permissionState === 'allow_all') {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('company_token') ||
        localStorage.getItem('manager_token') ||
        sessionStorage.getItem('token') ||
        '';

      // FIX 3: Request Wake Lock when driver is active
      requestWakeLock();

      // Send login notification to Manager & CEO
      if (token) {
        fetch('/api/fleet-tracking/driver-login-notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            driver_name: driverName,
            plate_number: plateNumber
          })
        }).catch(() => {});

        // Flush any offline pending coordinates immediately upon grant
        flushPendingLocations(token);
      }

      // FIX 1: Listen to online events to automatically flush offline buffered coordinates
      const handleOnline = () => {
        if (token) {
          flushPendingLocations(token);
        }
      };
      window.addEventListener('online', handleOnline);

      // Perform single GPS sync with dynamic power mode & retry
      const performGpsSync = () => {
        if (!navigator.geolocation || !token) return;

        const highAccuracy = isHighAccuracyRef.current;

        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude, speed, heading } = pos.coords;

            // FIX 7: Dynamic Low Power Mode
            const now = Date.now();
            if (lastCoordsRef.current) {
              const distanceMoved = calculateDistanceInMeters(
                lastCoordsRef.current.lat,
                lastCoordsRef.current.lng,
                latitude,
                longitude
              );

              // If moving > 20 meters, reset movement timer and resume high accuracy
              if (distanceMoved > 20) {
                lastMovementTimeRef.current = now;
                if (!isHighAccuracyRef.current) {
                  isHighAccuracyRef.current = true;
                }
              } else if (now - lastMovementTimeRef.current > 600000) {
                // Stationary for 10+ minutes -> Switch to low power
                if (isHighAccuracyRef.current) {
                  isHighAccuracyRef.current = false;
                }
              }
            }
            lastCoordsRef.current = { lat: latitude, lng: longitude };

            // 1. Update truck general location
            fetch('/api/fleet/trucks/update-location', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                lat: latitude,
                lng: longitude,
                speed: speed || 0,
                heading: heading || 0
              })
            }).catch(() => {});

            // 2. If active trip exists, update trip GPS with silent retry and offline buffering
            if (activeTripIdRef.current) {
              const tripRes = await sendLocationWithRetry(
                token,
                activeTripIdRef.current,
                latitude,
                longitude
              );

              if (tripRes.success && tripRes.trip?.trip_status === 'completed') {
                activeTripIdRef.current = null;
                setHasActiveTrip(false);
              }
            }
          },
          (err) => {
            console.warn('[Driver GPS] Location fetch error:', err.message);
          },
          {
            enableHighAccuracy: highAccuracy,
            maximumAge: highAccuracy ? 10000 : 60000,
            timeout: highAccuracy ? 25000 : 60000
          }
        );
      };

      const startGpsInterval = () => {
        if (!gpsIntervalRef.current) {
          performGpsSync();
          gpsIntervalRef.current = setInterval(performGpsSync, 60000);
        }
      };

      const stopGpsInterval = () => {
        if (gpsIntervalRef.current) {
          clearInterval(gpsIntervalRef.current);
          gpsIntervalRef.current = null;
        }
      };

      // FIX 8 & 11: Sync Active Trip & handle 10-minute idle suspension
      const syncActiveTrip = async () => {
        if (!token) return;
        try {
          const res = await getDriverActiveTrip(token);
          if (res.success && res.trip && res.trip.id) {
            activeTripIdRef.current = res.trip.id;
            setHasActiveTrip(true);

            // Active trip found -> clear idle timer & resume GPS tracking
            if (noTripTimerRef.current) {
              clearTimeout(noTripTimerRef.current);
              noTripTimerRef.current = null;
            }
            startGpsInterval();
          } else {
            activeTripIdRef.current = null;
            setHasActiveTrip(false);

            // FIX 8: If no active trip, set 10-minute timer to suspend GPS polling
            if (!noTripTimerRef.current) {
              noTripTimerRef.current = setTimeout(() => {
                stopGpsInterval();
              }, 600000); // 10 minutes
            }
          }
        } catch {
          // ignore
        }
      };

      // Initial active trip check
      syncActiveTrip();
      startGpsInterval();

      // Trip Assignment Check every 2 minutes
      tripCheckIntervalRef.current = setInterval(syncActiveTrip, 120000);

      // FIX 4: Page Visibility API
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          // App came back to foreground: trigger immediate GPS sync & re-acquire wake lock
          await syncActiveTrip();
          performGpsSync();
          if (!wakeLockRef.current) {
            await requestWakeLock();
          }
        } else {
          // App went to background: release screen wake lock to conserve resources
          await releaseWakeLock();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('online', handleOnline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        stopGpsInterval();
        if (tripCheckIntervalRef.current) {
          clearInterval(tripCheckIntervalRef.current);
          tripCheckIntervalRef.current = null;
        }
        if (noTripTimerRef.current) {
          clearTimeout(noTripTimerRef.current);
          noTripTimerRef.current = null;
        }
        releaseWakeLock();
      };
    }
  }, [permissionState, driverName, plateNumber, requestWakeLock, releaseWakeLock]);

  const handleChoice = (choice: 'allow_all' | 'allow_while_using' | 'denied') => {
    if (choice === 'allow_while_using') {
      // Do NOT accept this — immediately show permission request again forcing "Allow all the time"
      setPermissionState('prompting');
      setErrorMessage('Background location access is required ("Allow all the time"). Please select "Allow all the time".');
    } else if (choice === 'denied') {
      setPermissionState('denied');
    } else if (choice === 'allow_all') {
      setPermissionState('allow_all');
    }
  };

  // FIX 10: Confirm and execute driver logout
  const handleConfirmLogout = async () => {
    setShowLogoutConfirm(false);
    await releaseWakeLock();
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
    if (tripCheckIntervalRef.current) clearInterval(tripCheckIntervalRef.current);
    if (noTripTimerRef.current) clearTimeout(noTripTimerRef.current);
    activeTripIdRef.current = null;
    logout();
  };

  // IF DRIVER TAPS "Allow all the time" ✅
  if (permissionState === 'allow_all') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-between p-6 text-center font-sans select-none relative">
        <div className="my-auto space-y-6 max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto font-black text-xl">
            {companyName.charAt(0)}
          </div>

          <div className="space-y-3">
            <h1 className="text-xl font-black text-white leading-snug">
              Welcome, {driverName}! 🚛
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are now officially recognized as <strong className="text-white">{companyName}</strong> Truck Driver.
            </p>
          </div>

          {/* FIX 11: Dynamic Trip Status Badge */}
          {hasActiveTrip ? (
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full text-xs font-bold text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>● Active trip in progress</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-full text-xs font-bold text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span>● No active trip assigned</span>
            </div>
          )}
        </div>

        {/* FIX 10: Subtle Driver Logout Button at bottom */}
        <div className="pt-6 pb-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium cursor-pointer flex items-center gap-1.5 mx-auto py-2 px-4 rounded-xl hover:bg-slate-900/60"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* FIX 10: Sign Out Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-xs rounded-2xl p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Sign Out</h3>
                <p className="text-xs text-slate-300">
                  Are you sure you want to sign out? This will stop location sharing.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmLogout}
                  className="py-2.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // IF DRIVER DENIES "Don't allow" ❌
  if (permissionState === 'denied') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="space-y-6 max-w-sm w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Location Permission Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Please go to your phone Settings &gt; Apps &gt; Waybilla &gt; Permissions &gt; Location &gt; Allow all the time
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-3 text-left">
            <Settings className="w-5 h-5 text-amber-400 shrink-0" />
            <span>Driver accounts cannot access any part of the app without full background location permissions.</span>
          </div>

          <button
            onClick={() => setPermissionState('prompting')}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl text-xs transition-all cursor-pointer"
          >
            I have enabled it in Settings (Retry)
          </button>
        </div>
      </div>
    );
  }

  // Initial prompt state: Standard Android/iOS style popup with NO mention of location and only showing "Allow all the time"
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] text-white border border-slate-700 w-full max-w-xs rounded-2xl p-6 shadow-2xl space-y-5 text-center animate-scaleIn">
        {errorMessage && (
          <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-bold rounded-xl">
            {errorMessage}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-base font-bold text-white tracking-wide">
            Allow Waybilla?
          </h3>
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={() => handleChoice('allow_all')}
            className="w-full py-3 bg-[#0a84ff] hover:bg-[#0071e3] text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
          >
            Allow all the time
          </button>
        </div>
      </div>
    </div>
  );
};
