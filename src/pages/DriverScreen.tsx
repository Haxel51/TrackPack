import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Settings, ArrowLeft, LogOut, ShieldAlert, CheckCircle2, Navigation } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { NativeSettings, AndroidSettings } from 'capacitor-native-settings';
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
import { checkIsAndroidWebView } from '../modules/fleetTracking/fcm';

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

  // CAPACITOR NATIVE LOCATION STATES
  const isNativeApp = Capacitor.isNativePlatform();
  const [nativeLocationStatus, setNativeLocationStatus] = useState<
    'checking' | 'granted_always' | 'need_always_guidance' | 'denied' | 'max_attempts_exceeded'
  >('checking');
  const [settingsAttempts, setSettingsAttempts] = useState<number>(0);

  const activeTripIdRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  const isHighAccuracyRef = useRef<boolean>(true);
  const lastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const noTripTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tripCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSentLoginNotifyRef = useRef<boolean>(false);

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

  // CAPACITOR NATIVE LOCATION & SETTINGS CHECK EFFECT
  useEffect(() => {
    let isMounted = true;

    const checkAnyLocationGranted = async (): Promise<{ granted: boolean; details: any }> => {
      let statusDetails: any = {};
      // 1. Check AndroidBridge if available
      try {
        if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.hasLocationPermission === 'function') {
          const hasBridgePerm = (window as any).AndroidBridge.hasLocationPermission();
          statusDetails.androidBridge = hasBridgePerm;
          if (hasBridgePerm) {
            return { granted: true, details: statusDetails };
          }
        }
      } catch (e) {
        statusDetails.androidBridgeError = String(e);
      }

      // 2. Check Capacitor Geolocation
      try {
        const check = await Geolocation.checkPermissions();
        const locState = (check.location as string) || '';
        const coarseState = ((check as any).coarseLocation as string) || '';
        statusDetails.capacitorGeolocation = check;

        if (locState === 'granted' || locState === 'always' || coarseState === 'granted' || coarseState === 'always') {
          return { granted: true, details: statusDetails };
        }
      } catch (err) {
        statusDetails.capacitorGeolocationError = String(err);
        console.warn('Capacitor checkPermissions check error:', err);
      }

      // 3. Fallback check standard web navigator.permissions
      if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
        try {
          const p = await navigator.permissions.query({ name: 'geolocation' as any });
          statusDetails.webPermissions = p.state;
          if (p.state === 'granted') {
            return { granted: true, details: statusDetails };
          }
        } catch (e) {
          statusDetails.webPermissionsError = String(e);
        }
      }

      // 4. Quick non-blocking geolocation check
      return new Promise<{ granted: boolean; details: any }>((resolve) => {
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {
              statusDetails.getCurrentPosition = 'success';
              resolve({ granted: true, details: statusDetails });
            },
            (err) => {
              statusDetails.getCurrentPosition = 'error: ' + err.message;
              resolve({ granted: false, details: statusDetails });
            },
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
          );
        } else {
          statusDetails.getCurrentPosition = 'navigator.geolocation undefined';
          resolve({ granted: false, details: statusDetails });
        }
      });
    };

    const verifyNativePermission = async () => {
      try {
        const { granted: alreadyGranted, details } = await checkAnyLocationGranted();
        console.log('PERMISSION CHECK RESULT:', JSON.stringify(details));
        if (alreadyGranted) {
          console.log('PERMISSION GRANTED - HIDING GUIDE, SHOWING SUCCESS');
          if (isMounted) {
            setNativeLocationStatus('granted_always');
            setPermissionState('allow_all');
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('waybilla_driver_allowed', 'true');
            }
          }
          return;
        }

        // If not yet granted on native app, request permission once
        if (Capacitor.isPluginAvailable('Geolocation')) {
          try {
            const req = await Geolocation.requestPermissions();
            const reqLocState = (req.location as string) || '';
            const reqCoarseState = ((req as any).coarseLocation as string) || '';

            if (reqLocState === 'granted' || reqLocState === 'always' || reqCoarseState === 'granted' || reqCoarseState === 'always') {
              console.log('PERMISSION GRANTED - HIDING GUIDE, SHOWING SUCCESS');
              if (isMounted) {
                setNativeLocationStatus('granted_always');
                setPermissionState('allow_all');
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem('waybilla_driver_allowed', 'true');
                }
              }
              return;
            }
          } catch (reqErr) {
            console.warn('Geolocation.requestPermissions error:', reqErr);
          }
        }

        console.log('PERMISSION STILL NOT GRANTED - KEEPING GUIDE VISIBLE');
        if (isMounted) {
          console.log('GUIDE SCREEN SHOWN');
          setNativeLocationStatus('need_always_guidance');
        }
      } catch (err) {
        console.warn('Native permission check error:', err);
      }
    };

    if (checkIsAndroidWebView() || isNativeApp) {
      verifyNativePermission();
    }

    const handleResumeCheck = async () => {
      if (!isMounted) return;
      console.log('APP RETURNED TO FOREGROUND - CHECKING PERMISSIONS NOW');
      const { granted: isNowGranted, details } = await checkAnyLocationGranted();
      console.log('PERMISSION CHECK RESULT:', JSON.stringify(details));
      if (isNowGranted) {
        console.log('PERMISSION GRANTED - HIDING GUIDE, SHOWING SUCCESS');
        setNativeLocationStatus('granted_always');
        setPermissionState('allow_all');
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('waybilla_driver_allowed', 'true');
        }
      } else {
        console.log('PERMISSION STILL NOT GRANTED - KEEPING GUIDE VISIBLE');
      }
    };

    const appStateListener = App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive && isMounted) {
        await handleResumeCheck();
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResumeCheck();
      }
    };

    window.addEventListener('focus', handleResumeCheck);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', handleResumeCheck);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      appStateListener.then((l) => l.remove()).catch(() => {});
    };
  }, [isNativeApp]);

  const handleOpenNativeSettings = async () => {
    console.log('OPENING SETTINGS');
    try {
      if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.openLocationSettings === 'function') {
        (window as any).AndroidBridge.openLocationSettings();
        return;
      }
      if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.openAppSettings === 'function') {
        (window as any).AndroidBridge.openAppSettings();
        return;
      }
    } catch (e) {}

    try {
      await NativeSettings.openAndroid({
        option: AndroidSettings.ApplicationDetails,
      });
      return;
    } catch (err) {
      console.warn('Error opening native settings via NativeSettings plugin:', err);
    }

    try {
      window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.waybilla.app;end';
    } catch (e) {
      try {
        window.location.href = 'app-settings:com.waybilla.app';
      } catch (err) {
        setErrorMessage('Please go to phone Settings > Apps > Waybilla > Permissions > Location > Allow');
      }
    }
  };

  const handleManualLocationConfirmation = () => {
    setErrorMessage(null);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setNativeLocationStatus('granted_always');
          setPermissionState('allow_all');
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('waybilla_driver_allowed', 'true');
          }
        },
        (err) => {
          console.warn('Manual confirm geolocation error:', err);
          // Check Geolocation plugin
          Geolocation.checkPermissions().then((status) => {
            const st = status.location as string;
            if (st === 'granted' || st === 'always') {
              setNativeLocationStatus('granted_always');
              setPermissionState('allow_all');
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('waybilla_driver_allowed', 'true');
              }
            } else {
              setErrorMessage('Location is still turned off. Please ensure Location is enabled in Settings.');
            }
          }).catch(() => {
            setErrorMessage('Could not verify location. Please tap "Open Settings" and enable Location.');
          });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setNativeLocationStatus('granted_always');
      setPermissionState('allow_all');
    }
  };

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

      // Send login notification to Manager & CEO (strictly once per session)
      if (!hasSentLoginNotifyRef.current) {
        hasSentLoginNotifyRef.current = true;
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
      }

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

  const handleRequestNativePermission = () => {
    setErrorMessage(null);
    if (!navigator.geolocation) {
      setErrorMessage('Location services are not supported on this device or browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('waybilla_driver_allowed', 'true');
        }
        setPermissionState('allow_all');
      },
      (err) => {
        console.warn('Geolocation error / permission rejected:', err);
        setErrorMessage('Location permission was denied or dismissed. You MUST select "While using the app" for trip tracking.');
        setPermissionState('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  const handleChoice = (choice: 'allow_all' | 'allow_while_using' | 'denied') => {
    if (choice === 'denied') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('waybilla_driver_allowed');
      }
      setPermissionState('denied');
    } else {
      handleRequestNativePermission();
    }
  };

  // NATIVE APP OVERLAYS (Capacitor APK only)
  if (isNativeApp && nativeLocationStatus === 'need_always_guidance') {
    return (
      <div className="fixed inset-0 bg-[#050914] z-50 flex flex-col items-center justify-center p-6 text-center font-sans overflow-y-auto select-none">
        <div className="w-full max-w-sm bg-[#091026] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-5 animate-scaleIn">
          {/* 📍 Big Location Pin Icon */}
          <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto text-4xl shadow-inner">
            📍
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-white tracking-tight">
              One More Step Required
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed px-1">
              To track your location during deliveries, please enable <strong className="text-amber-400 font-extrabold">'Allow all the time'</strong> in your phone settings.
            </p>
          </div>

          {/* Step by step guide */}
          <div className="bg-[#050914] border border-blue-950 p-4 rounded-2xl text-left space-y-2.5 text-xs">
            <div className="font-extrabold text-amber-400 tracking-wide text-[11px] uppercase">
              Step by step guide:
            </div>
            <ol className="space-y-2 text-slate-200 font-medium text-xs">
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-[11px] flex items-center justify-center">1</span>
                <span>Tap <strong>'Open Settings'</strong> below</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-[11px] flex items-center justify-center">2</span>
                <span>Tap <strong>'Permissions'</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-[11px] flex items-center justify-center">3</span>
                <span>Tap <strong>'Location'</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 font-bold text-[11px] flex items-center justify-center">4</span>
                <span>Select <strong>'Allow all the time'</strong></span>
              </li>
            </ol>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-2xl text-left">
              {errorMessage}
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2.5">
            {/* Green Open Settings Button */}
            <button
              onClick={handleOpenNativeSettings}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-2xl text-xs transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              id="open-location-settings-btn"
            >
              <span>Open Settings</span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 italic pt-1">
            This is required for delivery tracking to work correctly
          </p>
        </div>
      </div>
    );
  }

  if (isNativeApp && nativeLocationStatus === 'max_attempts_exceeded') {
    return (
      <div className="fixed inset-0 bg-[#050914] z-50 flex flex-col items-center justify-center p-6 text-center font-sans select-none">
        <div className="w-full max-w-sm bg-[#091026] border border-rose-500/40 rounded-3xl p-6 shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto text-3xl">
            📍
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Location Access Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Location access is required for this app. Please make sure location permission is enabled for Waybilla in your device settings.
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={handleOpenNativeSettings}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Open Settings</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // IF DRIVER TAPS "Allow all the time" / "While using the app" ✅
  if (permissionState === 'allow_all' || permissionState === 'allow_while_using' || (isNativeApp && nativeLocationStatus === 'granted_always')) {
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

          {/* Dynamic Trip Status Badge */}
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

  // IF DRIVER DENIES "Don't allow" or "Only this time" revoked ❌
  if (permissionState === 'denied') {
    return (
      <div className="min-h-screen bg-[#050914] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="space-y-6 max-w-sm w-full bg-[#091026] border border-rose-500/30 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-black text-white">Location Access Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Waybilla requires continuous location permission to track your assigned truck and trips.
            </p>
          </div>

          {/* Android Visual Instruction Guide */}
          <div className="bg-[#050914] p-4 rounded-2xl border border-blue-950/80 text-left space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <ShieldAlert className="w-4 h-4" />
              <span>Required Android Setting:</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              When the popup appears, tap <strong className="text-blue-400">"While using the app"</strong> or go to:
            </p>
            <div className="bg-[#0c142c] p-2.5 rounded-xl text-[10px] font-mono text-slate-300 border border-blue-900/50">
              Settings &gt; Apps &gt; Waybilla &gt; Permissions &gt; Location &gt; <span className="text-emerald-400 font-bold">Allow only while using the app</span> (or Allow all the time)
            </div>
          </div>

          <button
            onClick={handleRequestNativePermission}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl text-xs transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Enable Location &amp; Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // Pre-permission prompt & Android instruction walkthrough
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#121829] text-white border border-blue-900/60 w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-scaleIn">
        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
          <Navigation className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white tracking-tight">
            Enable Trip Tracking
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Waybilla uses GPS to monitor your route and update dispatch in real-time.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-2xl text-left">
            {errorMessage}
          </div>
        )}

        {/* Visual Callout for "While using the app" */}
        <div className="bg-[#080d1e] border border-blue-900/50 rounded-2xl p-4 text-left space-y-2">
          <div className="text-[11px] font-extrabold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
            <span>👉 IMPORTANT STEP</span>
          </div>
          <p className="text-xs text-slate-200 leading-normal">
            When Android asks for permission, you <strong className="text-white">MUST select</strong>:
          </p>
          <div className="bg-blue-600 text-white font-extrabold text-xs py-2.5 px-3.5 rounded-xl flex items-center justify-between shadow-md">
            <span>While using the app</span>
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <p className="text-[10px] text-slate-400 italic">
            Do not select "Only this time" or "Don't allow" so your trip status remains active.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={handleRequestNativePermission}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl text-xs transition-all cursor-pointer shadow-lg active:scale-95"
          >
            Allow Location &amp; Start Driving
          </button>
        </div>
      </div>
    </div>
  );
};
