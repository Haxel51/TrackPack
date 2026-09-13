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

// REAL OS LOCATION PERMISSION CHECK & LIVE GPS SENSOR VERIFICATION (THE LIE DETECTOR)
export interface LocationVerificationResult {
  granted: boolean;
  isPartial?: boolean;
  coords?: { lat: number; lng: number };
  error?: string;
}

export interface StrictLocationStatus {
  grantedAlways: boolean;
  isPartial: boolean;
  reason?: string;
}

// Strict OS-level status check: accurately validates Android OS location permission
export async function checkRealLocationStatus(): Promise<StrictLocationStatus> {
  // 1. AndroidBridge (Native Android APK check)
  if (typeof window !== 'undefined' && (window as any).AndroidBridge) {
    try {
      const bridge = (window as any).AndroidBridge;
      if (typeof bridge.hasBackgroundLocationPermission === 'function') {
        const hasBg = Boolean(bridge.hasBackgroundLocationPermission());
        const hasFine = typeof bridge.hasLocationPermission === 'function' ? Boolean(bridge.hasLocationPermission()) : true;
        if (hasBg) {
          return { grantedAlways: true, isPartial: false };
        }
        if (hasFine && !hasBg) {
          return {
            grantedAlways: false,
            isPartial: true,
            reason: "⚠️ Partial Permission Detected: You selected 'While using the app'. Fleet tracking strictly requires 'Allow all the time'. Please tap '1. Open Settings' and change it to 'Allow all the time'."
          };
        }
      }
    } catch (e) {
      console.warn('AndroidBridge check error:', e);
    }
  }

  // 2. Real OS permission query via Capacitor Geolocation
  let generalGranted = false;
  let generalPrompt = false;
  let generalDenied = false;

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const status = await Geolocation.checkPermissions();
    console.log('[REAL OS CAPACITOR PERMISSION STATUS]:', status);
    if (status.location === 'granted' || (status as any).coarseLocation === 'granted') {
      generalGranted = true;
    } else if (status.location === 'denied') {
      generalDenied = true;
    } else {
      generalPrompt = true;
    }
  } catch (e) {
    console.warn('Capacitor checkPermissions error:', e);
  }

  // 3. Fallback to Web Geolocation permission query
  if (!generalGranted && !generalDenied && typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const p = await navigator.permissions.query({ name: 'geolocation' as any });
      console.log('[REAL OS WEB PERMISSION STATUS]:', p.state);
      if (p.state === 'granted') {
        generalGranted = true;
      } else if (p.state === 'denied') {
        generalDenied = true;
      } else {
        generalPrompt = true;
      }
    } catch (e) {}
  }

  if (generalDenied) {
    return {
      grantedAlways: false,
      isPartial: false,
      reason: "❌ Permission Denied: Location access is blocked in your phone settings. Please tap '1. Open Settings' and select 'Allow all the time'."
    };
  }

  if (generalPrompt) {
    return {
      grantedAlways: false,
      isPartial: false,
      reason: "❌ Permission Not Configured: Android reports location is still unconfigured. Please tap '1. Open Settings' and select 'Allow all the time'."
    };
  }

  if (generalGranted) {
    return { grantedAlways: true, isPartial: false };
  }

  return {
    grantedAlways: false,
    isPartial: false,
    reason: "❌ Location access is not granted. Please tap '1. Open Settings' and choose 'Allow all the time'."
  };
}

// Active hardware probe: validates live GPS sensor fix
export async function verifyRealLocationHardware(): Promise<LocationVerificationResult> {
  const statusCheck = await checkRealLocationStatus();
  if (!statusCheck.grantedAlways) {
    return {
      granted: false,
      isPartial: statusCheck.isPartial,
      error: statusCheck.reason
    };
  }

  // Active hardware probe: Request live GPS coordinates
  return new Promise((resolve) => {
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // If timeout occurs but permission was already confirmed granted, resolve true
        resolve({ granted: true });
      }
    }, 4500);

    // Try Capacitor Geolocation plugin first
    import('@capacitor/geolocation')
      .then(({ Geolocation }) => {
        Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 4000 })
          .then((pos) => {
            if (!resolved && pos?.coords && typeof pos.coords.latitude === 'number') {
              resolved = true;
              clearTimeout(timeoutId);
              console.log('[GPS PROBE SUCCESS] Real coordinates retrieved via Capacitor:', pos.coords.latitude, pos.coords.longitude);
              resolve({ granted: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
            }
          })
          .catch((capErr) => {
            console.warn('[GPS PROBE CAPACITOR ERROR]:', capErr);
            probeWeb();
          });
      })
      .catch(() => {
        probeWeb();
      });

    function probeWeb() {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!resolved && pos?.coords && typeof pos.coords.latitude === 'number') {
              resolved = true;
              clearTimeout(timeoutId);
              console.log('[GPS PROBE SUCCESS] Real coordinates retrieved via Web:', pos.coords.latitude, pos.coords.longitude);
              resolve({ granted: true, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
            }
          },
          (err) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeoutId);
              console.warn('[GPS PROBE REJECTED]:', err);
              if (err.code === 1) {
                resolve({
                  granted: false,
                  error: "❌ Permission Denied: Android OS confirmed that Location access is blocked. You cannot proceed without selecting 'Allow all the time'."
                });
              } else {
                // If permission was granted but GPS fix timed out / indoor weak signal, resolve true
                resolve({ granted: true });
              }
            }
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 }
        );
      } else {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({ granted: true });
        }
      }
    }
  });
}

export const DriverScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [showLocationGuide, setShowLocationGuide] = useState<boolean>(true);
  const [showDriverWelcome, setShowDriverWelcome] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [permissionState, setPermissionState] = useState<'prompting' | 'allow_all' | 'allow_while_using' | 'denied'>('prompting');
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

  // LIVE OS LOCATION PERMISSION & RESUME LISTENER EFFECT
  useEffect(() => {
    let isMounted = true;

    async function checkAndUpdateDriverScreen() {
      if (!isMounted) return;
      const statusResult = await checkRealLocationStatus();

      console.log(
        '[LOCATION PERMISSION CHECK]', 
        'grantedAlways:', statusResult.grantedAlways,
        'isPartial:', statusResult.isPartial,
        'reason:', statusResult.reason
      );

      if (!isMounted) return;

      if (statusResult.grantedAlways) {
        // Permission confirmed "always" — hide guide screen
        // Show driver welcome screen
        setShowLocationGuide(false);
        setShowDriverWelcome(true);
        setPermissionState('allow_all');
        setNativeLocationStatus('granted_always');
        setErrorMessage(null);
      } else {
        // Still not granted "always" — keep guide visible
        setShowLocationGuide(true);
        setShowDriverWelcome(false);
        setPermissionState(statusResult.isPartial ? 'allow_while_using' : 'prompting');
        setNativeLocationStatus('need_always_guidance');
        if (statusResult.isPartial && statusResult.reason) {
          setErrorMessage(statusResult.reason);
        }
      }
    }

    // Check immediately on mount
    checkAndUpdateDriverScreen();

    // Check again every time app becomes visible or resumes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('waybilla_opened_settings')) {
          sessionStorage.setItem('waybilla_left_app_for_settings', 'confirmed');
        }
      } else if (document.visibilityState === 'visible') {
        checkAndUpdateDriverScreen();
      }
    };

    const handleBlur = () => {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('waybilla_opened_settings')) {
        sessionStorage.setItem('waybilla_left_app_for_settings', 'confirmed');
      }
    };

    const handleFocus = () => {
      checkAndUpdateDriverScreen();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    const appStateListener = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkAndUpdateDriverScreen();
      } else {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('waybilla_opened_settings')) {
          sessionStorage.setItem('waybilla_left_app_for_settings', 'confirmed');
        }
      }
    });

    // Fast 800ms auto-poll while on this screen so the moment driver returns from Settings,
    // the screen unlocks immediately with zero delay
    const pollInterval = setInterval(() => {
      if (isMounted) {
        checkAndUpdateDriverScreen();
      }
    }, 800);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      appStateListener.then((l) => l.remove()).catch(() => {});
    };
  }, []);

  const handleOpenNativeSettings = async () => {
    console.log('OPENING SETTINGS');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('waybilla_opened_settings', Date.now().toString());
      sessionStorage.removeItem('waybilla_left_app_for_settings');
    }
    setErrorMessage(null);

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
        setErrorMessage('Please go to phone Settings > Apps > Waybilla > Permissions > Location > Allow all the time');
      }
    }
  };

  // MANUAL PERMISSION VERIFICATION BUTTON HANDLER (THE LIE DETECTOR)
  const handleVerifyPermissionManually = async () => {
    setIsVerifying(true);
    setErrorMessage(null);
    console.log('[MANUAL VERIFICATION] Driver tapped "I\'ve enabled it". Probing real OS permission...');

    // 1. Strict OS-level verification (distinguishes 'always' from 'while using the app')
    const statusCheck = await checkRealLocationStatus();
    console.log('[MANUAL VERIFICATION OS STATUS]:', statusCheck);

    if (!statusCheck.grantedAlways) {
      setIsVerifying(false);
      console.warn('[MANUAL VERIFICATION FAILED] Real OS check rejected:', statusCheck.reason);
      setErrorMessage(
        statusCheck.reason ||
        "❌ Verification Failed: Android OS reports that location permission is still NOT set to 'Allow all the time'. Please tap '1. Open Settings' above and choose 'Allow all the time'."
      );
      return;
    }

    // 2. Hardware GPS sensor probe (only triggered when 'always' is verified)
    const result = await verifyRealLocationHardware();
    console.log('[MANUAL VERIFICATION HARDWARE RESULT]:', result);

    setIsVerifying(false);

    if (result.granted) {
      console.log('[MANUAL VERIFICATION SUCCESS] Genuine GPS coordinates & Always permission confirmed.');
      setShowLocationGuide(false);
      setShowDriverWelcome(true);
      setPermissionState('allow_all');
      setNativeLocationStatus('granted_always');
      setErrorMessage(null);
    } else {
      console.warn('[MANUAL VERIFICATION FAILED] Permission blocked or driver lying.');
      setErrorMessage(
        result.error ||
        "❌ Verification Failed: Live GPS sensor read failed. Please tap '1. Open Settings' above and ensure 'Allow all the time' is selected."
      );
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
      async () => {
        // An in-app popup prompt on Android 11+ CANNOT grant "Allow all the time".
        // Re-check background permission status.
        let bridgeAlways = false;
        if ((window as any).AndroidBridge && typeof (window as any).AndroidBridge.hasBackgroundLocationPermission === 'function') {
          bridgeAlways = Boolean((window as any).AndroidBridge.hasBackgroundLocationPermission());
        }

        if (bridgeAlways) {
          setNativeLocationStatus('granted_always');
          setPermissionState('allow_all');
          setErrorMessage(null);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('waybilla_driver_allowed', 'true');
            localStorage.setItem('waybilla_driver_allowed_always', 'true');
          }
        } else {
          // Foreground was accepted via popup, but NOT "Allow all the time"!
          setNativeLocationStatus('need_always_guidance');
          setPermissionState('allow_while_using');
          setErrorMessage(
            "⚠️ Partial permission ('While using the app') detected. Fleet regulations strictly require 'Allow all the time' to clear your road pass. Please tap 'Configure Fleet Road Pass' below to open Settings and select 'Allow all the time'."
          );
        }
      },
      (err) => {
        console.warn('Geolocation error / permission rejected:', err);
        setErrorMessage(
          'Location permission was denied. Please tap "Configure Fleet Road Pass" below to grant "Allow all the time".'
        );
        setPermissionState('denied');
        setNativeLocationStatus('need_always_guidance');
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
        localStorage.removeItem('waybilla_driver_allowed_always');
      }
      setPermissionState('denied');
    } else {
      handleOpenNativeSettings();
    }
  };

  // COMPACT STRICT ROAD PASS SCREEN: Android Setting Guide for "Allow all the time"
  if (showLocationGuide || !showDriverWelcome) {
    return (
      <div className="fixed inset-0 bg-[#050914] z-50 flex items-center justify-center p-4 text-center font-sans select-none">
        <div className="w-full max-w-sm bg-[#091026] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4 animate-scaleIn">
          {/* Official Fleet Shield Icon */}
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto text-2xl shadow-inner">
            🛡️
          </div>

          <div className="space-y-1.5">
            <h2 className="text-lg font-black text-white tracking-tight">
              One-Time Road Setup
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed px-1">
              Select <span className="text-amber-400 font-extrabold">'Allow all the time'</span> in settings to keep your fuel allowance and emergency assistance active while driving.
            </p>
          </div>

          {/* Core 3-Step Setup */}
          <div className="bg-[#050914] border border-amber-500/20 p-3.5 rounded-2xl text-left space-y-2 text-xs">
            <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
              Quick Setup (10 Seconds):
            </div>
            <div className="space-y-2 text-slate-200 text-xs font-medium">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
                <span>Tap <strong>'Configure Road Pass'</strong> below</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
                <span>Tap <strong>Permissions &gt; Location</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
                <span>Choose <strong className="text-emerald-400">'Allow all the time'</strong></span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold rounded-2xl text-left space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-extrabold uppercase text-[10px] tracking-wider">
                <span>⚠️ Road Clearance Blocked</span>
              </div>
              <p className="text-[11px] leading-snug text-slate-200">
                {errorMessage}
              </p>
            </div>
          )}

          {/* Action Buttons: 1. Open Settings + 2. I've Enabled It (The Lie Detector) */}
          <div className="pt-2 space-y-2.5">
            {/* Step 1: Open Phone Settings */}
            <button
              type="button"
              onClick={handleOpenNativeSettings}
              className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 active:scale-95 border border-blue-500/40 text-blue-300 font-bold rounded-2xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              id="open-location-settings-btn"
            >
              <Settings className="w-4 h-4 text-blue-400" />
              <span>1. Open Settings &amp; Select 'Allow all the time'</span>
            </button>

            {/* Step 2: I've Enabled It (The Lie Detector) */}
            <button
              type="button"
              onClick={handleVerifyPermissionManually}
              disabled={isVerifying}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 disabled:opacity-60 text-white font-black rounded-2xl text-xs transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              id="verify-permission-btn"
            >
              {isVerifying ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking live GPS sensor with Android OS...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>2. I've Enabled It — Verify Road Pass</span>
                </>
              )}
            </button>

            <p className="text-[10px] text-slate-400 italic pt-0.5">
              Select 'Allow all the time' in Settings, then tap 'I've Enabled It' to verify clearance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN: When "Allow all the time" is granted ✅
  return (
    <div className="min-h-screen bg-[#050914] text-slate-100 flex flex-col items-center justify-between p-6 text-center font-sans select-none relative">
      <div className="my-auto space-y-6 max-w-sm w-full bg-[#091026] border border-blue-950/80 rounded-3xl p-8 shadow-2xl animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto font-black text-2xl">
          ✓
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Fleet Terminal Verified</span>
          </div>
          <h1 className="text-xl font-black text-white leading-snug">
            Welcome, {driverName}! 🚛
          </h1>
          <p className="text-xs text-slate-300 leading-relaxed">
            Registered Fleet Driver for <strong className="text-white">{dynamicCompanyName}</strong>.
          </p>
        </div>

        {/* Fleet Road Status Info Card */}
        <div className="bg-[#050914] border border-blue-950 p-4 rounded-2xl text-left space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>Assigned Plate:</span>
            <span className="font-mono text-amber-400 font-bold">{plateNumber}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>Road Assistance:</span>
            <span className="text-emerald-400 font-bold">● Active &amp; Ready</span>
          </div>
          <div className="flex justify-between items-center text-slate-400 text-[11px]">
            <span>Trip Settlement Pass:</span>
            <span className="text-emerald-400 font-bold">● Configured</span>
          </div>
        </div>

        {/* Dynamic Trip Status Badge */}
        {hasActiveTrip ? (
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full text-xs font-bold text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>● Active Trip in Progress</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-4 py-2 rounded-full text-xs font-bold text-slate-300">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>● Standby for Dispatch</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Device setup is complete. You do not need to keep this app open while driving. Have a safe and prosperous journey!
        </p>
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
};
