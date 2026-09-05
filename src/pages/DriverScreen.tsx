import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Settings, ArrowLeft, LogOut } from 'lucide-react';
import { 
  getDriverActiveTrip,
  sendDriverHeartbeat,
  checkDriverReinstall
} from '../modules/fleetTracking/api';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import {
  sendLocationWithRetry,
  flushPendingLocations,
} from '../modules/fleetTracking/offlineLocationSync';

// FEATURE 2 — DEVICE ID GENERATION & DEVICE INFO HELPERS
export function getDeviceId(): string {
  let deviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('fleet_device_id') : null;
  if (!deviceId) {
    deviceId = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : ('device_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('fleet_device_id', deviceId);
    }
  }
  return deviceId;
}

export function getDeviceInfo() {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    platform: typeof navigator !== 'undefined' ? navigator.platform : '',
    screenWidth: typeof window !== 'undefined' && window.screen ? window.screen.width : 0,
    screenHeight: typeof window !== 'undefined' && window.screen ? window.screen.height : 0,
    language: typeof navigator !== 'undefined' ? navigator.language : 'en',
    timestamp: new Date().toISOString()
  };
}

// FEATURE 1 — DAILY HEARTBEAT CONSTANT
const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [permissionState, setPermissionState] = useState<'prompting' | 'allow_all' | 'allow_while_using' | 'denied'>(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('waybilla_driver_allowed') === 'true') {
      return 'allow_all';
    }
    return 'prompting';
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasActiveTrip, setHasActiveTrip] = useState<boolean>(false);

  const activeTripIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isHighAccuracyRef = useRef<boolean>(true);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const noTripTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tripCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [dynamicCompanyName, setDynamicCompanyName] = useState<string>(() => {
    if (user?.company_name && user.company_name !== 'Transport Company') {
      return user.company_name;
    }
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('driver_company_name') : null;
    return cached || user?.company_name || 'Transport Company';
  });

  const driverName = user?.name || 'Driver';
  const plateNumber = (user as any)?.plate_number || 'Truck Plate';
  const driverId = user?.id || '';

  // DYNAMIC COMPANY RESOLUTION: Fetch official registered company name
  useEffect(() => {
    let isMounted = true;
    async function resolveRegisteredCompany() {
      try {
        const companyId = user?.company_id || (user as any)?.companyId;
        const driverPhone = user?.phone;

        // 1. Direct query on companies collection with companyId
        if (companyId && companyId !== 'default_company') {
          const compSnap = await getDoc(doc(db, 'companies', companyId));
          if (compSnap.exists()) {
            const data = compSnap.data();
            const resolved = data.company_name || data.name || data.park_name;
            if (resolved && isMounted) {
              setDynamicCompanyName(resolved);
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('driver_company_name', resolved);
              }
              return;
            }
          }
        }

        // 2. Query driver record in fleetTracking_users
        if (driverId) {
          const ftSnap = await getDoc(doc(db, 'fleetTracking_users', driverId));
          if (ftSnap.exists()) {
            const ftData = ftSnap.data();
            if (ftData.company_name && ftData.company_name !== 'Transport Company') {
              if (isMounted) {
                setDynamicCompanyName(ftData.company_name);
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('driver_company_name', ftData.company_name);
                }
                return;
              }
            }
            const cId = ftData.companyId || ftData.company_id;
            if (cId && cId !== 'default_company') {
              const compSnap = await getDoc(doc(db, 'companies', cId));
              if (compSnap.exists()) {
                const data = compSnap.data();
                const resolved = data.company_name || data.name || data.park_name;
                if (resolved && isMounted) {
                  setDynamicCompanyName(resolved);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('driver_company_name', resolved);
                  }
                  return;
                }
              }
            }
          }
        }

        // 3. Query fleetTracking_trucks by driver phone
        if (driverPhone) {
          const qTruck = query(collection(db, 'fleetTracking_trucks'), where('driver_phone', '==', driverPhone), limit(1));
          const tSnap = await getDocs(qTruck);
          if (!tSnap.empty) {
            const tData = tSnap.docs[0].data();
            if (tData.company_name && tData.company_name !== 'Transport Company') {
              if (isMounted) {
                setDynamicCompanyName(tData.company_name);
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('driver_company_name', tData.company_name);
                }
                return;
              }
            }
            if (tData.company_id && tData.company_id !== 'default_company') {
              const compSnap = await getDoc(doc(db, 'companies', tData.company_id));
              if (compSnap.exists()) {
                const data = compSnap.data();
                const resolved = data.company_name || data.name;
                if (resolved && isMounted) {
                  setDynamicCompanyName(resolved);
                  if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('driver_company_name', resolved);
                  }
                  return;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Could not dynamically resolve driver company name:', err);
      }
    }
    resolveRegisteredCompany();
    return () => {
      isMounted = false;
    };
  }, [user, driverId]);

  // FEATURE 1 — SEND HEARTBEAT
  const sendHeartbeat = useCallback(async (targetDriverId: string) => {
    if (!targetDriverId) return;
    try {
      let locationPerm = 'prompt';
      try {
        if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' as any });
          locationPerm = permissionStatus.state;
        } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
          locationPerm = permissionState === 'denied' ? 'denied' : 'granted';
        }
      } catch {
        locationPerm = permissionState === 'denied' ? 'denied' : 'granted';
      }

      const currentDeviceId = getDeviceId();
      const currentDeviceInfo = getDeviceInfo();

      // 1. Send via backend API
      await sendDriverHeartbeat({
        driverId: targetDriverId,
        locationPermission: locationPerm,
        deviceId: currentDeviceId,
        deviceInfo: currentDeviceInfo,
        driverName: user?.name,
        driverPhone: user?.phone,
        companyId: user?.company_id || (user as any)?.companyId
      }).catch(() => {});

      // 2. Direct Firestore update for immediate redundancy
      try {
        const driverRef = doc(db, 'fleetTracking_users', targetDriverId);
        await updateDoc(driverRef, {
          lastHeartbeatAt: serverTimestamp(),
          locationPermission: locationPerm,
          appInstalled: true,
          deviceId: currentDeviceId,
          deviceInfo: currentDeviceInfo
        });

        // PART B — DETECT LOCATION PERMISSION OFF
        if (locationPerm === 'denied') {
          await addDoc(collection(db, 'fleetTracking_users', targetDriverId, 'events'), {
            type: 'location_permission_disabled',
            timestamp: serverTimestamp(),
            driverName: user?.name || 'Driver',
            driverPhone: user?.phone || '',
            companyId: user?.company_id || (user as any)?.companyId || '',
            deviceId: currentDeviceId
          });
        }
      } catch (fsErr) {
        console.warn('[Heartbeat Direct Firestore Update]:', fsErr);
      }
    } catch (err) {
      console.warn('[Heartbeat Error]:', err);
    }
  }, [permissionState, user]);

  // FEATURE 1 — START & STOP HEARTBEAT SYSTEM
  const startHeartbeat = useCallback((targetDriverId: string) => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    // Send immediately on app open/login
    sendHeartbeat(targetDriverId);
    // Then send every 24 hours
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(targetDriverId);
    }, HEARTBEAT_INTERVAL);
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // FEATURE 2 — REINSTALL DETECTION ON LOGIN / APP LAUNCH
  const checkReinstallFlow = useCallback(async (targetDriverId: string) => {
    if (!targetDriverId) return;
    try {
      const currentDeviceId = getDeviceId();
      const currentDeviceInfo = getDeviceInfo();

      // 1. API Verification
      await checkDriverReinstall({
        driverId: targetDriverId,
        deviceId: currentDeviceId,
        deviceInfo: currentDeviceInfo,
        driverData: user
      }).catch(() => {});

      // 2. Direct Firestore Verification
      try {
        const driverRef = doc(db, 'fleetTracking_users', targetDriverId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
          const data = driverSnap.data();
          const savedDeviceId = data.deviceId;
          const loginCount = data.loginCount || 0;

          if (!savedDeviceId) {
            // First time login ever
            await updateDoc(driverRef, {
              deviceId: currentDeviceId,
              firstLoginAt: serverTimestamp(),
              lastLoginAt: serverTimestamp(),
              loginCount: 1,
              lastLoginDevice: currentDeviceInfo,
              reinstallCount: 0
            });
          } else if (savedDeviceId !== currentDeviceId) {
            // Device ID changed — app was reinstalled
            const nextCount = (data.reinstallCount || 0) + 1;
            await updateDoc(driverRef, {
              deviceId: currentDeviceId,
              lastLoginAt: serverTimestamp(),
              loginCount: loginCount + 1,
              lastLoginDevice: currentDeviceInfo,
              reinstallDetectedAt: serverTimestamp(),
              reinstallCount: nextCount
            });

            await addDoc(collection(db, 'fleetTracking_users', targetDriverId, 'events'), {
              type: 'app_reinstalled',
              timestamp: serverTimestamp(),
              newDeviceId: currentDeviceId,
              previousDeviceId: savedDeviceId,
              driverName: data.full_name || data.name || user?.name || 'Driver',
              driverPhone: data.phone || user?.phone || '',
              companyId: data.companyId || user?.company_id || '',
              deviceInfo: currentDeviceInfo,
              reinstallCount: nextCount
            });
          } else {
            // Same device — normal login
            await updateDoc(driverRef, {
              lastLoginAt: serverTimestamp(),
              loginCount: loginCount + 1
            });
          }
        }
      } catch (fsErr) {
        console.warn('[Reinstall Direct Firestore Update]:', fsErr);
      }
    } catch (err) {
      console.warn('[Check Reinstall Flow Error]:', err);
    }
  }, [user]);

  // Launch Reinstall Check & Daily Heartbeat on Mount
  useEffect(() => {
    if (driverId) {
      checkReinstallFlow(driverId);
      startHeartbeat(driverId);
    }
    return () => {
      stopHeartbeat();
    };
  }, [driverId, checkReinstallFlow, startHeartbeat, stopHeartbeat]);

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
      const activeToken =
        token ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('manager_token') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('company_token') : null) ||
        sessionStorage.getItem('token') ||
        '';

      const cachedUser = typeof localStorage !== 'undefined' && localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null;
      const effectiveUser = user || cachedUser || {};
      const effectiveDriverName = effectiveUser?.name || effectiveUser?.driver_name || driverName || 'Driver';
      const effectivePlateNumber = (effectiveUser as any)?.plate_number || (effectiveUser as any)?.truck_plate || plateNumber || 'Truck Plate';
      const effectiveDriverPhone = effectiveUser?.phone || effectiveUser?.owner_phone || effectiveUser?.phone_number || '';
      const effectiveCompanyId = effectiveUser?.company_id || (effectiveUser as any)?.companyId || '';

      // FIX 3: Request Wake Lock when driver is active
      requestWakeLock();

      // Send login notification to Manager & CEO
      fetch('/api/fleet-tracking/driver-login-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {})
        },
        body: JSON.stringify({
          driver_name: effectiveDriverName,
          plate_number: effectivePlateNumber,
          driver_phone: effectiveDriverPhone,
          company_id: effectiveCompanyId
        })
      }).catch((err) => {
        console.warn('driver-login-notify error:', err);
      });

      if (activeToken) {
        // Flush any offline pending coordinates immediately upon grant
        flushPendingLocations(activeToken);
      }

      // FIX 1: Listen to online events to automatically flush offline buffered coordinates
      const handleOnline = () => {
        if (activeToken) {
          flushPendingLocations(activeToken);
        }
      };
      window.addEventListener('online', handleOnline);

      // Perform single GPS sync with dynamic power mode & retry
      const performGpsSync = () => {
        if (!navigator.geolocation) return;

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
            if (activeToken) {
              fetch('/api/fleet/trucks/update-location', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${activeToken}`
                },
                body: JSON.stringify({
                  lat: latitude,
                  lng: longitude,
                  speed: speed || 0,
                  heading: heading || 0
                })
              }).catch(() => {});
            }

            // 2. If active trip exists, update trip GPS with silent retry and offline buffering
            if (activeTripIdRef.current && activeToken) {
              const tripRes = await sendLocationWithRetry(
                activeToken,
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
        if (!activeToken) return;
        try {
          const res = await getDriverActiveTrip(activeToken);
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
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('waybilla_driver_allowed');
      }
      setPermissionState('denied');
    } else if (choice === 'allow_all') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('waybilla_driver_allowed', 'true');
      }
      setPermissionState('allow_all');
    }
  };

  // IF DRIVER TAPS "Allow all the time" ✅
  if (permissionState === 'allow_all') {
    return (
      <div className="min-h-screen bg-[#050914] text-slate-100 flex flex-col items-center justify-between p-6 text-center font-sans select-none relative">
        <div className="my-auto space-y-6 max-w-sm w-full bg-[#091026] border border-blue-950/80 rounded-3xl p-8 shadow-2xl animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto font-black text-xl">
            {(dynamicCompanyName || 'T').charAt(0).toUpperCase()}
          </div>

          <div className="space-y-3">
            <h1 className="text-xl font-black text-white leading-snug">
              Welcome, {driverName}! 🚛
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              You are now officially recognized as <strong className="text-white">{dynamicCompanyName}</strong> Truck Driver.
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

        {/* Driver Actions: Return to Home (keeps session) or Sign Out (ends session) */}
        <div className="pt-6 pb-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-300 hover:text-white transition-colors font-semibold cursor-pointer flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-[#091026] hover:bg-[#131e3d] border border-blue-950/80 shadow-md active:scale-95"
            aria-label="Return to Home"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Return to Home</span>
          </button>

          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="text-xs text-rose-300 hover:text-rose-100 transition-colors font-semibold cursor-pointer flex items-center gap-2 py-2.5 px-4 rounded-2xl bg-[#1b0d14] hover:bg-[#2b101c] border border-rose-900/60 shadow-md active:scale-95"
            aria-label="Sign Out"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    );
  }

  // IF DRIVER DENIES "Don't allow" ❌
  if (permissionState === 'denied') {
    return (
      <div className="min-h-screen bg-[#050914] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="space-y-6 max-w-sm w-full bg-[#091026] border border-rose-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Location Permission Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Please go to your phone Settings &gt; Apps &gt; Waybilla &gt; Permissions &gt; Location &gt; Allow all the time
            </p>
          </div>

          <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80 text-[11px] text-slate-400 flex items-center gap-3 text-left">
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
      <div className="bg-[#1e1e1e] text-white border border-blue-900/60 w-full max-w-xs rounded-2xl p-6 shadow-2xl space-y-5 text-center animate-scaleIn">
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
