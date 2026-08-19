import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFleetTrips, shareDriverLocation } from '../lib/api';
import { getFleetTripNarrative } from '../lib/fleetNarrative';
import { Logo } from '../components/Logo';
import {
  Truck,
  MapPin,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Building2,
  LogOut,
  Phone,
  MessageSquare,
  Navigation,
  WifiOff,
  Radio,
  Compass,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Activity,
  LocateFixed,
  Loader2,
  Smile,
  Sparkles
} from 'lucide-react';

const FUNNY_DRIVER_PRESETS = [
  { id: 'highway', label: 'Road Clear, Motor Dey Fly! 🚀', icon: '🛣️', note: 'Road is clear! Cruising on highway, no wahala at all 💨' },
  { id: 'traffic', label: 'Heavy Go-Slow / Traffic! 🛑', icon: '🤦‍♂️', note: 'Heavy traffic jam / hold-up on the road, moving small-small 🐢' },
  { id: 'fueling', label: 'Chop Food / Buy Diesel 🍲⛽', icon: '⛽', note: 'Driver stopping to chop small food / buy diesel for motor 😋' },
  { id: 'checkpoint', label: 'Police / Army Checkpoint 🚧', icon: '👮‍♂️', note: 'Showing vehicle particulars at highway checkpoint 📄' },
  { id: 'weather', label: 'Heavy Rain / Bad Road 🌧️', icon: '🌧️', note: 'Heavy rain falling & big pot-holes, driving gentle-gentle 🕳️' },
  { id: 'tyre', label: 'Tyre Punch / Vulcanizer 🛞', icon: '🔧', note: 'Flat tyre issue! Vulcanizer currently pumping/fixing tyre 🛞' },
  { id: 'arrived_gate', label: 'I Don Reach Gate! 🏢', icon: '📍', note: 'Arrived at the factory / customer gate! Awaiting clearance 🚪' },
  { id: 'offloading', label: 'Offloading Goods Now 📦', icon: '💪', note: 'Boys are currently offloading goods from the truck 📦' }
];

const FUNNY_ROAD_TIPS = [
  "💡 Driver Tip: Sleep no be friend of steering wheel! Drink water if eye dey heavy 🚫😴",
  "🚚 Oga Driver, na you be the road pilot! Your company dey proud of you 🌟",
  "🛡️ Smooth driving brings long life and fat pocket! Enjoy the journey 💰",
  "🙏 God dey in control of this highway! Safe arrival in Jesus name 🕊️",
  "⛽ Motor hungry? Feed am diesel make e no vex for expressway! 🤣"
];

export const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Online / Offline Status
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Duty State
  const [isOnDuty, setIsOnDuty] = useState<boolean>(() => {
    return localStorage.getItem('driver_on_duty') !== 'false';
  });

  // Random funny tip index
  const [tipIndex, setTipIndex] = useState(0);

  // GPS Acquisition State
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'checking' | 'active' | 'denied'>('idle');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number; speed?: number | null } | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Location Sharing Action State
  const [sharingLocation, setSharingLocation] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customNote, setCustomNote] = useState('');
  const [shareSuccessMessage, setShareSuccessMessage] = useState<string | null>(null);

  // Tab View for Mobile (Active Trip vs Completed History)
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  // History Accordion toggle
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Cycle funny tips
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % FUNNY_ROAD_TIPS.length);
    }, 12000);
    return () => clearInterval(tipInterval);
  }, []);

  // Reliable GPS Request Function with progressive fallback
  const requestGPSAccess = useCallback((showFeedback = false) => {
    if (showFeedback) setIsCalibrating(true);
    setGpsStatus('checking');

    if (!('geolocation' in navigator)) {
      setGpsStatus('denied');
      if (showFeedback) {
        setTimeout(() => {
          if (isMountedRef.current) setIsCalibrating(false);
        }, 800);
      }
      return;
    }

    const startTime = Date.now();

    // Try high accuracy first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        const { latitude, longitude, accuracy, speed } = pos.coords;
        setGpsCoords({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          speed: speed !== null ? Math.round(speed * 3.6) : null
        });
        setGpsStatus('active');
        if (showFeedback) {
          const elapsed = Date.now() - startTime;
          setTimeout(() => {
            if (isMountedRef.current) setIsCalibrating(false);
          }, Math.max(0, 800 - elapsed));
        }
      },
      (err) => {
        console.warn('High-accuracy GPS failed, trying fallback...', err.message);

        // Fallback: low accuracy with longer timeout
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            if (!isMountedRef.current) return;
            const { latitude, longitude, accuracy, speed } = fallbackPos.coords;
            setGpsCoords({
              lat: latitude,
              lng: longitude,
              accuracy: Math.round(accuracy),
              speed: speed !== null ? Math.round(speed * 3.6) : null
            });
            setGpsStatus('active');
            if (showFeedback) {
              const elapsed = Date.now() - startTime;
              setTimeout(() => {
                if (isMountedRef.current) setIsCalibrating(false);
              }, Math.max(0, 800 - elapsed));
            }
          },
          (fallbackErr) => {
            if (!isMountedRef.current) return;
            console.warn('GPS fallback error:', fallbackErr.message);
            setGpsStatus('denied');
            if (showFeedback) {
              const elapsed = Date.now() - startTime;
              setTimeout(() => {
                if (isMountedRef.current) setIsCalibrating(false);
              }, Math.max(0, 800 - elapsed));
            }
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );
  }, []);

  // Check on mount
  useEffect(() => {
    requestGPSAccess(false);
  }, [requestGPSAccess]);

  // Network listener
  useEffect(() => {
    isMountedRef.current = true;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleDuty = () => {
    const next = !isOnDuty;
    setIsOnDuty(next);
    localStorage.setItem('driver_on_duty', String(next));
  };

  const fetchTrips = async (isBackground = false) => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!isBackground) setLoading(true);

    try {
      const data = await getFleetTrips(token);
      if (isMountedRef.current) {
        if (data && data.success) {
          setTrips(data.trips || []);
          setError(null);
        } else {
          setError(data?.error || 'Could not fetch your trips right now.');
        }
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Network problem. Please check your data connection.');
      }
    } finally {
      if (isMountedRef.current && !isBackground) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token]);

  // Quiet background sync every 45s
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchTrips(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [token]);

  const activeTrips = trips.filter(t => t.status !== 'completed');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const currentActiveTrip = activeTrips.length > 0 ? activeTrips[0] : null;

  // 1-Tap Location & Preset Broadcast
  const handleBroadcast = async (tripId: string, presetObj?: typeof FUNNY_DRIVER_PRESETS[0]) => {
    if (!token) return;

    setSharingLocation(true);
    setShareSuccessMessage(null);

    const noteToUse = presetObj?.note || customNote.trim() || 'Driver sent highway road update 🚚';
    const presetId = presetObj?.id || selectedPreset || undefined;

    const doSubmit = async (lat?: number, lng?: number, accuracy?: number, speed?: number | null) => {
      try {
        const data = await shareDriverLocation(token, tripId, {
          note: noteToUse,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          speed: speed ?? undefined,
          preset: presetId,
          source: 'proactive'
        });

        if (!data || !data.success) throw new Error(data?.error || 'Failed to send update.');

        const coordNote = lat ? ` (Phone GPS: ±${accuracy || 10}m)` : '';
        setShareSuccessMessage(`Update sent to Oga!${coordNote} 👍`);
        setCustomNote('');
        setSelectedPreset('');
        fetchTrips(true);
        setTimeout(() => setShareSuccessMessage(null), 4500);
      } catch (err: any) {
        alert(err.message || 'Could not send update. Please try again.');
      } finally {
        setSharingLocation(false);
      }
    };

    if (gpsCoords) {
      await doSubmit(gpsCoords.lat, gpsCoords.lng, gpsCoords.accuracy, gpsCoords.speed);
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, accuracy, speed } = pos.coords;
          const roundedAcc = Math.round(accuracy);
          const spd = speed !== null ? Math.round(speed * 3.6) : null;
          setGpsCoords({ lat: latitude, lng: longitude, accuracy: roundedAcc, speed: spd });
          setGpsStatus('active');
          doSubmit(latitude, longitude, roundedAcc, spd);
        },
        () => {
          doSubmit();
        },
        { enableHighAccuracy: true, timeout: 4000, maximumAge: 10000 }
      );
    } else {
      doSubmit();
    }
  };

  const managerPhone = user?.manager_phone || user?.company_phone || null;
  const truckPlate = user?.truck?.truck_number || user?.truck_number || currentActiveTrip?.truck_number || 'My Truck';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-20 sm:pb-8">
      {/* Offline Alert Banner */}
      {!isOnline && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center space-x-2 shadow-lg sticky top-0 z-50 animate-pulse">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>No internet network right now. Your updates will send as soon as service returns.</span>
        </div>
      )}

      {/* Clean Driver Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-slate-900/95">
        <div className="max-w-4xl mx-auto px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Logo size="sm" />
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-black text-white leading-none">
                  {user?.name || 'Driver'}
                </h1>
                <button
                  type="button"
                  onClick={toggleDuty}
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all ${
                    isOnDuty
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnDuty ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                  <span>{isOnDuty ? 'On Duty' : 'Off Duty'}</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-400 font-mono font-medium mt-0.5 flex items-center space-x-1">
                <Truck className="w-3 h-3 inline" />
                <span>{truckPlate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={logout}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-bold"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="max-w-4xl mx-auto w-full px-4 py-4 space-y-3.5 flex-1">
        {/* Funny Highway Quote / Tip Box */}
        <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/20 rounded-2xl flex items-center space-x-2.5 text-xs">
          <Smile className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-amber-200/90 font-medium leading-tight">
            {FUNNY_ROAD_TIPS[tipIndex]}
          </p>
        </div>

        {/* TAB SWITCHER */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setActiveTab('active')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Current Trip ({activeTrips.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Past Trips ({completedTrips.length})</span>
          </button>
        </div>

        {/* Global Loading / Error */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-xs font-medium">Checking your assigned motor trips...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Trip Notice</p>
              <p className="text-[11px] text-rose-300/80 mt-0.5">{error}</p>
              <button
                onClick={() => fetchTrips(false)}
                className="mt-1.5 text-xs font-bold underline cursor-pointer text-amber-300"
              >
                Tap here to try again
              </button>
            </div>
          </div>
        ) : activeTab === 'active' ? (
          /* ACTIVE TRIP VIEW */
          currentActiveTrip ? (
            <div className="space-y-4">
              {(() => {
                const trip = currentActiveTrip;
                const narrativeInfo = getFleetTripNarrative(trip);
                const isOverdue = narrativeInfo.isOverdue;

                const isLeftWarehouse = Boolean(trip.left_warehouse_at || trip.status === 'left_warehouse' || trip.status === 'loaded_departed');
                const isLoadedDeparted = Boolean(trip.loaded_departed_at || trip.status === 'loaded_departed');
                const isArrived = trip.status === 'arrived_at_destination' || trip.status === 'completed';

                return (
                  <div className="space-y-4">
                    {/* Active Trip Hero Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
                      {/* Top Header */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black font-mono">
                            TRUCK: {trip.truck_number || truckPlate}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            #{trip.id.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                            trip.status === 'loaded_departed'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : trip.status === 'left_warehouse'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {narrativeInfo.stageBadgeText}
                        </span>
                      </div>

                      {/* Origin to Destination */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-950/70 border border-slate-800/80 rounded-2xl">
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 block">
                            Where You Carry Load (Park)
                          </span>
                          <p className="text-xs font-black text-white mt-0.5 flex items-center space-x-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{trip.company_name || user?.company_name || 'Loading Park'}</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold tracking-wider text-amber-400 block">
                            Where You Are Dropping Load (Destination)
                          </span>
                          <p className="text-xs font-black text-amber-300 mt-0.5 flex items-center space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{trip.supplier_name || 'Customer / Factory Gate'}</span>
                          </p>
                        </div>
                      </div>

                      {/* 3 Easy Journey Steps */}
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <span className={isLeftWarehouse ? 'text-amber-400' : 'text-slate-500'}>1. Left Park 🛣️</span>
                          <span className={isLoadedDeparted ? 'text-blue-400' : 'text-slate-500'}>2. On Road 🚚</span>
                          <span className={isArrived ? 'text-emerald-400' : 'text-slate-500'}>3. Delivered 📦</span>
                        </div>
                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800 flex">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isArrived
                                ? 'w-full bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : isLoadedDeparted
                                ? 'w-2/3 bg-blue-400 shadow-sm shadow-blue-400/50'
                                : isLeftWarehouse
                                ? 'w-1/3 bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'w-1/12 bg-slate-700'
                            }`}
                          ></div>
                        </div>
                      </div>

                      {/* Overdue Warning */}
                      {isOverdue && narrativeInfo.overdueWarning && (
                        <div className="bg-amber-950/80 border border-amber-500/80 text-amber-200 p-3 rounded-2xl flex items-start space-x-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 text-xs">
                            <p className="font-bold text-amber-300">Time to Update Your Oga ⏰</p>
                            <p className="leading-relaxed text-amber-100 text-[11px]">{narrativeInfo.overdueWarning}</p>
                          </div>
                        </div>
                      )}

                      {/* Status Narrative Feed */}
                      <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-start space-x-2.5">
                        <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1">
                          <p className="text-xs font-semibold text-slate-200 leading-snug">
                            "{narrativeInfo.narrative}"
                          </p>
                          {trip.last_location_at && (
                            <p className="text-[10px] text-slate-500">
                              Last update: {new Date(trip.last_location_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {trip.last_location_note || 'Location update sent'}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Fast Action Contacts */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {managerPhone ? (
                          <a
                            href={`tel:${managerPhone.replace(/\D/g, '')}`}
                            className="min-h-[42px] p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 border border-slate-700 transition-all cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Call Oga Manager</span>
                          </a>
                        ) : null}

                        {managerPhone ? (
                          <a
                            href={`https://wa.me/${managerPhone.replace(/\D/g, '').replace(/^0/, '234')}?text=${encodeURIComponent(
                              `Hello Oga Manager, this is Driver ${user?.name || 'Driver'} (Truck: ${trip.truck_number || truckPlate}). Trip: ${trip.supplier_name || 'Destination'}. Road Status: ${trip.last_location_note || 'We dey highway en route'}.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[42px] p-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-emerald-500/40 transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>WhatsApp Oga</span>
                          </a>
                        ) : null}

                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            trip.supplier_name || 'Nigeria Interstate Expressway'
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[42px] p-2.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 text-blue-200 font-bold text-xs flex items-center justify-center space-x-1.5 border border-blue-500/40 transition-all cursor-pointer"
                        >
                          <Navigation className="w-3.5 h-3.5 text-blue-400" />
                          <span>Open Road Map</span>
                        </a>
                      </div>
                    </div>

                    {/* ⚡ 1-TAP QUICK UPDATE BUTTONS */}
                    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 rounded-xl bg-amber-400/20 text-amber-400">
                            <Radio className="w-4 h-4 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">Tell Oga Where You Reach Now</h3>
                            <p className="text-[11px] text-amber-300 font-medium">Just tap any button below!</p>
                          </div>
                        </div>

                        {/* Location indicator */}
                        <button
                          type="button"
                          onClick={() => requestGPSAccess(true)}
                          className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 text-[10px] font-bold text-slate-300 flex items-center space-x-1.5 cursor-pointer"
                        >
                          {isCalibrating ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                              <span>Finding GPS...</span>
                            </>
                          ) : gpsCoords ? (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-300">GPS Ready (±{gpsCoords.accuracy}m)</span>
                            </>
                          ) : (
                            <>
                              <LocateFixed className="w-3 h-3 text-amber-400" />
                              <span>Check GPS</span>
                            </>
                          )}
                        </button>
                      </div>

                      {shareSuccessMessage && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>{shareSuccessMessage}</span>
                        </div>
                      )}

                      {/* Main Big Send Location Button */}
                      <button
                        type="button"
                        disabled={sharingLocation}
                        onClick={() => handleBroadcast(trip.id)}
                        className="w-full min-h-[50px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {sharingLocation ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending update to Oga...</span>
                          </>
                        ) : (
                          <>
                            <Compass className="w-4 h-4" />
                            <span>⚡ Send Live Location to Oga Now</span>
                          </>
                        )}
                      </button>

                      {/* Quick Highway Status Buttons Grid */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Or Just Tap What is Happening on Road:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {FUNNY_DRIVER_PRESETS.map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              disabled={sharingLocation}
                              onClick={() => handleBroadcast(trip.id, preset)}
                              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-400/50 text-left transition-all active:scale-[0.98] cursor-pointer group disabled:opacity-50"
                            >
                              <div className="text-xl mb-0.5">{preset.icon}</div>
                              <p className="text-[11px] font-bold text-slate-200 group-hover:text-amber-300 leading-tight">
                                {preset.label}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Note Input */}
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                          Type Your Own Message (e.g. Village or Junction Name):
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            placeholder="e.g. Passing Ore toll gate / Benin bypass..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-amber-400 transition-colors"
                          />
                          <button
                            type="button"
                            disabled={sharingLocation || !customNote.trim()}
                            onClick={() => handleBroadcast(trip.id)}
                            className="min-h-[42px] px-4 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center space-x-1 transition-colors disabled:opacity-40 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        </div>
                      </div>

                      {/* Check-In History Stream */}
                      {trip.location_shares && trip.location_shares.length > 0 && (
                        <div className="pt-2 border-t border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                            <span>Your Recent Updates Sent Today</span>
                            <span>{trip.location_shares.length} updates</span>
                          </div>
                          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {trip.location_shares.slice().reverse().map((share: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] flex items-center justify-between"
                              >
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-200">{share.note}</p>
                                  {share.latitude && (
                                    <p className="text-[9px] font-mono text-slate-500">
                                      GPS: {share.latitude.toFixed(4)}, {share.longitude.toFixed(4)}
                                    </p>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-2">
                                  {new Date(share.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* NO ACTIVE TRIP */
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-3 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center mx-auto">
                <Truck className="w-6 h-6 opacity-80" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">No Assigned Trip Right Now</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  When your motor park or company manager assigns a delivery trip to your truck, it will show here immediately!
                </p>
              </div>
            </div>
          )
        ) : (
          /* COMPLETED TRIPS VIEW */
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Past Delivered Trips ({completedTrips.length})</span>
            </h2>

            {completedTrips.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center text-slate-400 space-y-1.5">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-semibold">You have not completed any past trips yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {completedTrips.map(trip => {
                  const isExpanded = expandedTripId === trip.id;
                  return (
                    <div
                      key={trip.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-2"
                    >
                      <div
                        onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                        className="flex items-center justify-between cursor-pointer select-none"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              DELIVERED COMPLETE
                            </span>
                            <span className="text-xs font-bold text-white">
                              {trip.supplier_name || 'Destination'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Truck: {trip.truck_number || truckPlate} • {new Date(trip.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="pt-2.5 border-t border-slate-800/80 space-y-2 text-[11px] text-slate-300 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950 rounded-xl">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Trip Started</span>
                              <span>{new Date(trip.created_at).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase font-bold">Delivery Done</span>
                              <span>{trip.arrived_offloaded_at ? new Date(trip.arrived_offloaded_at).toLocaleString() : 'Delivered'}</span>
                            </div>
                          </div>
                          {trip.location_shares && trip.location_shares.length > 0 && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Total road updates sent: {trip.location_shares.length}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
