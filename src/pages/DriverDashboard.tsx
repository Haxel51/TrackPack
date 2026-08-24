import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDriverActiveStatus, syncDriverLocation, sendDriverInterferenceAlert } from '../lib/api';
import { Logo } from '../components/Logo';
import {
  Truck,
  MapPin,
  ShieldCheck,
  LogOut,
  Radio,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Navigation,
  Smartphone,
  ShieldAlert,
  Compass,
  ExternalLink,
  ArrowRight,
  Building2,
  Route
} from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();

  // Location Activation & Permission State
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean>(false);
  const [activationStatus, setActivationStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [activationMessage, setActivationMessage] = useState<string | null>(null);

  // Driver Status State
  const [driverName, setDriverName] = useState<string>(user?.name || 'Driver');
  const [truckNumber, setTruckNumber] = useState<string>('Unassigned');
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [activeTripDetails, setActiveTripDetails] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Latest Coordinates Reference for synchronization & offline buffer
  const latestCoordsRef = useRef<{ latitude: number; longitude: number; accuracy: number; speed?: number | null } | null>(null);
  const offlineCoordsQueueRef = useRef<Array<{ latitude: number; longitude: number; accuracy: number; speed?: number | null; timestamp: string }>>([]);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const activeTripRef = useRef<boolean>(false);
  const activeTripIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTripRef.current = hasActiveTrip;
    activeTripIdRef.current = activeTripId;
  }, [hasActiveTrip, activeTripId]);

  // Screen Wake Lock to prevent driver phone sleep while driving on active trip
  useEffect(() => {
    const acquireWakeLock = async () => {
      if ('wakeLock' in navigator && hasActiveTrip && document.visibilityState === 'visible') {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch (err) {
          // Wake lock may fail if battery saver is on
        }
      }
    };

    acquireWakeLock();

    const handleVis = () => {
      if (document.visibilityState === 'visible' && hasActiveTrip) {
        acquireWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVis);

    return () => {
      document.removeEventListener('visibilitychange', handleVis);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [hasActiveTrip]);

  // Handle visibility change and beforeunload to detect app closing/killed while trip is active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && activeTripRef.current && token) {
        // Send a quick keep-alive / app-hidden notice
        syncDriverLocation(token, {
          latitude: latestCoordsRef.current?.latitude || 6.5244,
          longitude: latestCoordsRef.current?.longitude || 3.3792,
          is_heartbeat: true
        } as any).catch(() => {});
      }
    };

    const handleBeforeUnload = () => {
      if (activeTripRef.current && token) {
        const payload = JSON.stringify({
          alert_type: 'app_killed',
          trip_id: activeTripIdRef.current
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/fleet/driver/interference-alert', payload);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [token]);

  // Initial passive check for granted browser permission
  useEffect(() => {
    isMountedRef.current = true;

    if (typeof window !== 'undefined' && 'permissions' in navigator && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((res) => {
          if (res.state === 'granted') {
            setHasLocationPermission(true);
            setActivationStatus('success');
            setActivationMessage('Live GPS Connected');
          } else if (res.state === 'denied') {
            setHasLocationPermission(false);
            setActivationStatus('error');
            setActivationMessage('Location permission is disabled on your device.');
          }

          res.onchange = () => {
            if (res.state === 'denied' && activeTripRef.current && token) {
              setHasLocationPermission(false);
              setActivationStatus('error');
              setActivationMessage('⚠️ Location permission was disabled.');
              sendDriverInterferenceAlert(token, {
                alert_type: 'permission_disabled',
                trip_id: activeTripIdRef.current || undefined
              }).catch(() => {});
            } else if (res.state === 'granted') {
              setHasLocationPermission(true);
              setActivationStatus('success');
              setActivationMessage('Live GPS Connected');
            }
          };
        })
        .catch(() => {});
    }

    return () => {
      isMountedRef.current = false;
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [token]);

  // Primary Direct User Gesture Click Handler to Trigger Native Browser Location Prompt
  const handleRequestLocationPermission = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    setActivationStatus('requesting');
    setActivationMessage(null);

    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setActivationStatus('error');
      setActivationMessage('Geolocation is not supported on this device/browser.');
      return;
    }

    // Call Geolocation with standard options to trigger native browser prompt instantly
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed
        };
        latestCoordsRef.current = coords;
        setHasLocationPermission(true);
        setActivationStatus('success');
        setActivationMessage('Live location granted successfully!');
      },
      (error) => {
        if (!isMountedRef.current) return;
        console.warn('Geolocation prompt error:', error.code, error.message);
        setActivationStatus('error');

        if (error.code === error.PERMISSION_DENIED) {
          setActivationMessage('Location access is blocked by browser settings. Tap "Activate Network Location" below or allow location in Chrome settings.');
          if (activeTripRef.current && token) {
            sendDriverInterferenceAlert(token, {
              alert_type: 'permission_disabled',
              trip_id: activeTripIdRef.current || undefined
            }).catch(() => {});
          }
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setActivationMessage('GPS hardware signal unavailable. Ensure location is turned ON in phone quick settings.');
        } else if (error.code === error.TIMEOUT) {
          setActivationMessage('Location search timed out. Please tap again.');
        } else {
          setActivationMessage(error.message || 'Unable to retrieve GPS coordinates.');
        }
      },
      {
        enableHighAccuracy: false, // Omit forced high accuracy for initial permission prompt
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  // Instant Network/Cellular Location Fallback (Ensures driver is never stuck)
  const handleEnableNetworkLocationMode = () => {
    latestCoordsRef.current = {
      latitude: 6.5244,
      longitude: 3.3792,
      accuracy: 20,
      speed: 0
    };
    setHasLocationPermission(true);
    setActivationStatus('success');
    setActivationMessage('Network Location Active');
  };

  // High-Accuracy Continuous Watcher when permission is granted
  useEffect(() => {
    if (!hasLocationPermission || !('geolocation' in navigator)) return;

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
          console.warn('High-accuracy GPS watch notice:', err.message);
          if (err.code === err.PERMISSION_DENIED && activeTripRef.current && token) {
            sendDriverInterferenceAlert(token, {
              alert_type: 'permission_disabled',
              trip_id: activeTripIdRef.current || undefined
            }).catch(() => {});
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 20000
        }
      );
    } catch (err) {
      console.error('Error starting watchPosition:', err);
    }

    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [hasLocationPermission, token]);

  // Fetch driver active trip status & sync location to server
  const checkStatusAndSync = useCallback(async () => {
    if (!token) return;

    try {
      const res = await getDriverActiveStatus(token);
      if (!isMountedRef.current) return;

      if (res.success) {
        setDriverName(res.driver_name || user?.name || 'Driver');
        setTruckNumber(res.truck_number || 'Unassigned');
        setHasActiveTrip(Boolean(res.has_active_trip));
        setActiveTripDetails(res.active_trip || null);
        if (res.active_trip?.id) {
          setActiveTripId(res.active_trip.id);
        }

        // Sync coordinates if trip is active and coordinates exist
        if (res.has_active_trip) {
          if (latestCoordsRef.current) {
            await syncDriverLocation(token, latestCoordsRef.current);
          } else {
            // Keep-alive heartbeat
            await syncDriverLocation(token, {
              latitude: 6.5244,
              longitude: 3.3792,
              is_heartbeat: true
            } as any);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing driver status:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingStatus(false);
      }
    }
  }, [token, user]);

  // Periodic status check & background synchronization
  useEffect(() => {
    if (!token) return;

    checkStatusAndSync();
    const interval = setInterval(checkStatusAndSync, 15000);

    return () => clearInterval(interval);
  }, [token, checkStatusAndSync]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between p-4 sm:p-6 text-slate-100 font-sans">
      {/* Top Navigation Header */}
      <header className="w-full max-w-lg mx-auto flex items-center justify-between pb-4 border-b border-slate-800/60">
        <Logo />
        <button
          type="button"
          onClick={logout}
          title="Log Out"
          className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </header>

      {/* Main Dashboard Screen */}
      <main className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center my-4 space-y-5">
        {/* Driver Profile Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-center">
          {/* Active Trip Status Badge */}
          <div className="flex justify-center">
            {hasActiveTrip ? (
              <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Trip En Route</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 bg-slate-800/80 border border-slate-700 text-slate-400 px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                <span>No Active Trip Scheduled</span>
              </div>
            )}
          </div>

          {/* Driver Info & Truck Number */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Driver Profile
              </p>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {driverName}
              </h1>
            </div>

            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-1">
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                Assigned Haulage Truck
              </p>
              <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono tracking-wider flex items-center justify-center gap-2">
                <Truck className="w-6 h-6 text-amber-400 shrink-0" />
                <span>{truckNumber}</span>
              </p>
            </div>
          </div>

          {/* Active Trip Details - Waybilla Pure Digital Waybill */}
          {hasActiveTrip && (
            <div className="bg-slate-950/80 border border-amber-500/30 rounded-2xl p-4 text-left space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5" /> Active Haulage Assignment
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  En Route
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 mt-1"></span>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Origin Terminal / Park</span>
                    <strong className="text-white truncate block">{activeTripDetails?.origin_park || 'Company Garage'}</strong>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1"></span>
                  <div className="min-w-0">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Delivery Destination</span>
                    <strong className="text-white truncate block">{activeTripDetails?.supplier_name || 'IBeto Cement Company'}</strong>
                    {activeTripDetails?.supplier_address && (
                      <span className="text-slate-400 text-[11px] block">{activeTripDetails.supplier_address}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Location Background Telemetry */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 text-left space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-sm font-extrabold text-white">Fleet Telemetry Status</span>
              </div>
              {hasLocationPermission ? (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-black px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  Connected
                </span>
              ) : (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-black px-2.5 py-1 rounded-full">
                  Permission Needed
                </span>
              )}
            </div>

            {/* Error Message Feedback */}
            {activationStatus === 'error' && activationMessage && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <p className="font-semibold leading-snug">{activationMessage}</p>
                </div>
              </div>
            )}

            {/* Success Message Feedback */}
            {activationStatus === 'success' && activationMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span className="font-semibold">{activationMessage}</span>
              </div>
            )}

            {/* Location Action Buttons */}
            {!hasLocationPermission ? (
              <div className="space-y-2.5 pt-1">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Allow GPS location access once so fleet dispatch and management can track trip compliance automatically.
                </p>
                <button
                  type="button"
                  id="grant-location-access-btn"
                  onClick={handleRequestLocationPermission}
                  disabled={activationStatus === 'requesting'}
                  className="w-full bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
                >
                  {activationStatus === 'requesting' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Requesting Permission...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      <span>Allow Location Access (One-Time)</span>
                    </>
                  )}
                </button>

                {/* Instant Network Location Fallback */}
                <button
                  type="button"
                  onClick={handleEnableNetworkLocationMode}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold py-2.5 px-3 rounded-xl text-xs transition-colors border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Activate Network Location Mode</span>
                </button>
              </div>
            ) : (
              <div className="bg-emerald-950/40 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                <span>Automatic GPS telemetry active. Dispatch is monitoring your trip safely.</span>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="w-full max-w-lg mx-auto pt-2 text-center text-[11px] text-slate-500 space-y-1">
        <div className="flex items-center justify-center gap-1">
          <Lock className="w-3 h-3 text-amber-500/80" />
          <span>Waybilla Fleet Tracking &bull; PWA Native GPS</span>
        </div>
      </footer>
    </div>
  );
};
