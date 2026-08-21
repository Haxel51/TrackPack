import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDriverActiveStatus, syncDriverLocation } from '../lib/api';
import { Logo } from '../components/Logo';
import {
  Truck,
  MapPin,
  ShieldCheck,
  LogOut,
  Radio,
  AlertCircle,
  CheckCircle2,
  Lock
} from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();

  // Location Permission Gate State
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Driver Status State
  const [driverName, setDriverName] = useState<string>(user?.name || 'Driver');
  const [truckNumber, setTruckNumber] = useState<string>('Unassigned');
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Latest Coords Ref for background sync
  const latestCoordsRef = useRef<{ latitude: number; longitude: number; accuracy: number; speed?: number | null } | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Mandatory Location Permission Request
  const requestLocationPermission = useCallback(() => {
    setRequestingPermission(true);
    setPermissionError(null);

    if (!('geolocation' in navigator)) {
      setPermissionError('Your device does not support GPS Geolocation. Please use a device with GPS capability.');
      setHasLocationPermission(false);
      setRequestingPermission(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        latestCoordsRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed
        };
        setHasLocationPermission(true);
        setRequestingPermission(false);
      },
      (error) => {
        if (!isMountedRef.current) return;
        console.warn('Geolocation access error:', error.message);
        setHasLocationPermission(false);
        setRequestingPermission(false);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionError('Location permission is mandatory. Please open your browser or device settings and set Location to "Always Allow" or "Allow While Using App".');
        } else {
          setPermissionError('Unable to acquire GPS fix. Please ensure your device Location/GPS is turned ON in system settings.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    );
  }, []);

  // Check initial permission on mount
  useEffect(() => {
    isMountedRef.current = true;
    requestLocationPermission();

    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [requestLocationPermission]);

  // Continuous Background Watcher
  useEffect(() => {
    if (!hasLocationPermission || !('geolocation' in navigator)) return;

    // Start continuous GPS watch
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          latestCoordsRef.current = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed
          };
        },
        (err) => {
          console.warn('Continuous GPS watch notification:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000
        }
      );
    } catch (e) {
      console.error('Error starting watchPosition:', e);
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [hasLocationPermission]);

  // Fetch driver active status & run background synchronization
  const checkStatusAndSync = useCallback(async () => {
    if (!token) return;

    try {
      const res = await getDriverActiveStatus(token);
      if (!isMountedRef.current) return;

      if (res.success) {
        setDriverName(res.driver_name || user?.name || 'Driver');
        setTruckNumber(res.truck_number || 'Unassigned');
        setHasActiveTrip(Boolean(res.has_active_trip));

        // If trip is ACTIVE and we have GPS coordinates, automatically sync to server
        if (res.has_active_trip && latestCoordsRef.current) {
          await syncDriverLocation(token, latestCoordsRef.current);
        }
      }
    } catch (err) {
      console.error('Error checking driver active status:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingStatus(false);
      }
    }
  }, [token, user]);

  // Initial and periodic background sync (every 15 seconds)
  useEffect(() => {
    if (!token || !hasLocationPermission) return;

    checkStatusAndSync();
    const interval = setInterval(checkStatusAndSync, 15000);

    return () => clearInterval(interval);
  }, [token, hasLocationPermission, checkStatusAndSync]);

  // ----------------------------------------------------
  // SCREEN 1: Mandatory Location Permission Prompt
  // ----------------------------------------------------
  if (hasLocationPermission === false || (hasLocationPermission === null && requestingPermission)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <MapPin className="w-8 h-8 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Location Access Required 📍
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Oga Driver, no hiding in mama put corner! 🍲🤣 Waybilla requires mandatory <strong>"Always Allow"</strong> or <strong>"Allow While Using App"</strong> location permission so your haulage trips track automatically in the background.
            </p>
          </div>

          {permissionError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-2xl text-xs text-left flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{permissionError}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={requestLocationPermission}
              disabled={requestingPermission}
              className="w-full bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black py-3.5 rounded-2xl text-sm transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {requestingPermission ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0A1F44] border-t-transparent rounded-full animate-spin"></div>
                  <span>Requesting GPS Access...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>Grant Location Access</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </div>

          <p className="text-[11px] text-slate-500">
            🔒 Location is only active during scheduled trips. Outside of active trips, location tracking is strictly disabled.
          </p>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SCREEN 2: Minimal Background Driver Screen
  // Driver sees only: Name, Assigned Truck, Trip Status
  // No buttons, no status updates, no portal features
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between pb-4">
        <Logo />
        <button
          type="button"
          onClick={logout}
          title="Log Out"
          className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Status Container */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          {/* Status Indicator Badge */}
          <div className="flex justify-center">
            {hasActiveTrip ? (
              <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Trip</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 bg-slate-800/80 border border-slate-700 text-slate-400 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span>No Active Trip</span>
              </div>
            )}
          </div>

          {/* Driver Name & Truck Number */}
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                Driver
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {driverName}
              </h1>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                Assigned Truck
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-wider flex items-center justify-center gap-2">
                <Truck className="w-6 h-6 text-amber-400 shrink-0" />
                <span>{truckNumber}</span>
              </p>
            </div>
          </div>

          {/* Background Tracking Description */}
          <div className="bg-slate-950/40 border border-slate-800/50 rounded-2xl p-3.5 text-xs text-slate-400 leading-relaxed">
            {hasActiveTrip ? (
              <p className="flex items-center justify-center gap-2 text-emerald-300 font-medium">
                <Radio className="w-4 h-4 animate-pulse text-emerald-400 shrink-0" />
                <span>GPS tracking is active and syncing in the background. Safe journey, oga driver! 🚚💨</span>
              </p>
            ) : (
              <p className="text-slate-400">
                Tracking is resting 😴. It will start by itself once your next trip starts. Relax and enjoy good music! 🎵
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Minimal Footer Notice */}
      <footer className="w-full max-w-lg mx-auto pt-4 text-center text-[11px] text-slate-600">
        Waybilla Automated Fleet GPS &bull; Background Mode
      </footer>
    </div>
  );
};
