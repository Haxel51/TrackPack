import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Package,
  Building2,
  User,
  KeyRound,
  X,
  HelpCircle,
  Phone,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Truck,
  Receipt,
  Bell,
  Clock,
  ChevronRight,
  Lock,
  Sparkles
} from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import { triggerOSNotification } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { token, role, user } = useAuth();

  const cachedToken = typeof localStorage !== 'undefined'
    ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('manager_token')
    : null;
  const cachedRole = typeof localStorage !== 'undefined'
    ? localStorage.getItem('auth_role')
    : null;
  const cachedUser = typeof localStorage !== 'undefined' && localStorage.getItem('auth_user')
    ? (() => {
        try {
          return JSON.parse(localStorage.getItem('auth_user')!);
        } catch {
          return null;
        }
      })()
    : null;

  const activeToken = token || cachedToken;
  const activeRole = role || cachedRole || cachedUser?.role || (cachedUser?.manager_type === 'Driver' ? 'driver' : cachedUser?.manager_type === 'Trip Monitor' ? 'trip_monitor' : null);

  const [trackingCode, setTrackingCode] = useState('');
  const [trackAlert, setTrackAlert] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackedWaybill, setTrackedWaybill] = useState<any>(null);
  const [trackedRoute, setTrackedRoute] = useState<any>(null);
  const [trackedDriver, setTrackedDriver] = useState<any>(null);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [showStaffPortalsModal, setShowStaffPortalsModal] = useState(false);

  const [secretTaps, setSecretTaps] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('track');
    if (codeParam) {
      setTrackingCode(codeParam);
      performTrack(codeParam);
    }
  }, []);

  useEffect(() => {
    if (!trackedWaybill || !trackedWaybill.tracking_code) return;

    let eventSource: EventSource | null = null;
    const code = trackedWaybill.tracking_code;

    try {
      eventSource = new EventSource(`/api/notifications/stream?code=${encodeURIComponent(code)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'WAYBILL_UPDATE') {
            triggerOSNotification(data.title || 'Waybilla Shipment Update 🚚', {
              body: data.body || 'Status updated on your tracked waybill.',
              tag: code
            });
            performTrack(code);
          }
        } catch (e) {
          // ignore
        }
      };
    } catch {
      // Ignore background SSE connection errors
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [trackedWaybill?.tracking_code]);

  const performTrack = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) return;
    setIsTracking(true);
    setTrackAlert(null);
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(cleanCode)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTrackAlert(data.error || "We could not find this waybill code. Please double-check the tracking code printed on your receipt.");
      } else {
        setTrackedWaybill(data.waybill);
        setTrackedRoute(data.route);
        setTrackedDriver(data.driver);
      }
    } catch (err) {
      console.error("Tracking request failed:", err);
      setTrackAlert("Could not reach the tracking server. Please check your internet connection and try again.");
    } finally {
      setIsTracking(false);
    }
  };

  const handleSecretTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 1500) {
      const nextCount = secretTaps + 1;
      setSecretTaps(nextCount);
      if (nextCount >= 5) {
        setSecretTaps(0);
        navigate('/login/admin');
      }
    } else {
      setSecretTaps(1);
    }
    setLastTapTime(now);
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performTrack(trackingCode);
  };

  const handleClearTrack = () => {
    setTrackingCode('');
    setTrackedWaybill(null);
    setTrackedRoute(null);
    setTrackedDriver(null);
    setTrackAlert(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="bg-[#0A1F44] text-white border-b-2 border-[#F2A93B]/40 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div
            onClick={handleSecretTap}
            className="flex items-center gap-2.5 cursor-pointer select-none"
            title="Waybilla"
          >
            <Logo size="md" showText={false} />
            <div className="flex items-center gap-1 font-black text-xl tracking-tight">
              <span>Way<span className="text-[#F2A93B]">billa</span></span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />

            {activeToken && (
              <button
                onClick={() => {
                  if (activeRole === 'customer') navigate('/customer/dashboard');
                  else if (activeRole === 'staff') navigate('/staff/dashboard');
                  else if (activeRole === 'company') navigate('/company/dashboard');
                  else navigate('/manager/dashboard');
                }}
                className="bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl w-full mx-auto flex-grow px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Title & Subtitle */}
        <div className="text-center space-y-3.5 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[#0A1F44] text-xs font-black shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Nigeria’s Waybill Tracking Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0A1F44] tracking-tight leading-tight">
            Track Your Waybill <br className="hidden sm:inline" />
            <span className="text-[#0A1F44]">Step-by-Step</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed max-w-lg mx-auto">
            Follow your goods from park to park across Nigeria. Instant milestone updates, verified digital receipts, and secure pickup PIN.
          </p>
        </div>

        {/* The Tracking Command Bar */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-6 shadow-xl shadow-slate-200/50 space-y-4 max-w-2xl mx-auto">
          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-grow">
              <label htmlFor="tracking-code-input" className="sr-only">Waybill Tracking Code or Phone Number</label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
                id="tracking-code-input"
                name="trackingCode"
                type="text"
                placeholder="Enter Waybill Code (e.g. NNW-8392) or Phone..."
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0A1F44] focus:ring-2 focus:ring-[#0A1F44]/10 rounded-2xl py-3.5 sm:py-4 pl-12 pr-4 text-sm sm:text-base font-bold placeholder-slate-400 outline-none uppercase transition-all"
                aria-label="Enter waybill tracking code"
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={isTracking || !trackingCode.trim()}
              className="bg-[#F2A93B] hover:bg-[#d9922b] disabled:opacity-50 text-[#0A1F44] font-black px-7 py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 shrink-0 min-h-[48px]"
            >
              {isTracking ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0A1F44] border-t-transparent rounded-full animate-spin"></div>
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <span>Track Package</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Helper Line */}
          <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-500 pt-1 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official waybill code from your paper or digital receipt</span>
            </span>
            {trackingCode && (
              <button
                type="button"
                onClick={handleClearTrack}
                className="text-red-500 hover:text-red-700 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {trackAlert && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3.5 rounded-2xl text-xs font-semibold space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚠️ {trackAlert}</span>
              </div>
              <p className="text-[11px] text-rose-700 font-normal">
                Check the code printed on the receipt issued to you at the motor park counter, or sign in to your Customer Portal below.
              </p>
            </div>
          )}
        </div>

        {/* Tracked Shipment Result Card */}
        {trackedWaybill && (
          <div className="max-w-2xl mx-auto space-y-3 animate-fadeIn">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">
                  Live Waybill Status
                </h3>
              </div>
              <button
                onClick={handleClearTrack}
                className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Result</span>
              </button>
            </div>
            <ShipmentTimeline waybill={trackedWaybill} route={trackedRoute} driver={trackedDriver} showReceiptButton={true} />
          </div>
        )}

        {/* Milestone Checkpoint Demonstration (The "Temu Experience") */}
        {!trackedWaybill && (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                  <span>How Waybill Checkpoints Work</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                  Just like Temu &amp; Amazon — verified step-by-step terminal milestones
                </p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 font-extrabold text-[10px] px-2.5 py-1 rounded-full border border-emerald-200/60">
                100% Guaranteed
              </span>
            </div>

            {/* Visual Step-by-Step Progress Track */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
              {/* Step 1 */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 relative">
                <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-900 font-black text-xs flex items-center justify-center">
                  1
                </div>
                <div className="font-extrabold text-xs text-[#0A1F44]">Received at Park</div>
                <p className="text-[11px] text-slate-500 font-medium leading-snug">
                  Sender drops carton at counter; staff issues official receipt.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 relative">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center">
                  2
                </div>
                <div className="font-extrabold text-xs text-[#0A1F44]">Bus Dispatched</div>
                <p className="text-[11px] text-slate-500 font-medium leading-snug">
                  Loaded into vehicle; marked in transit to destination.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 relative">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center">
                  3
                </div>
                <div className="font-extrabold text-xs text-[#0A1F44]">Arrived at Park</div>
                <p className="text-[11px] text-slate-500 font-medium leading-snug">
                  Destination park logs vehicle; receiver gets arrival alert.
                </p>
              </div>

              {/* Step 4 */}
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 relative">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-900 font-black text-xs flex items-center justify-center">
                  4
                </div>
                <div className="font-extrabold text-xs text-[#0A1F44]">Pickup via PIN</div>
                <p className="text-[11px] text-slate-500 font-medium leading-snug">
                  Receiver shows secret 4-digit code to collect goods.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* The Two Executive Doors (Customer vs Transport Company) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Door 1: Customer Portal */}
          <div className="bg-gradient-to-br from-[#0A1F44] to-[#122e60] rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between border border-blue-900/30">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-[#F2A93B] text-[#0A1F44] flex items-center justify-center font-black text-xl shadow-xs">
                  📱
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-white/10 text-amber-300 border border-white/10">
                  Senders &amp; Receivers
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-black tracking-tight">Customer Portal</h2>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Log in with your phone number to see all parcels sent or received, download official receipts, and reveal your pickup PIN.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/login/customer')}
              className="w-full bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Open Customer Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Door 2: Transport Company & Park Staff */}
          <div className="bg-white border-2 border-slate-200/90 rounded-3xl p-6 text-slate-900 shadow-md space-y-4 flex flex-col justify-between hover:border-[#0A1F44]/40 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-[#F2A93B] flex items-center justify-center font-black text-xl shadow-xs">
                  🏢
                </div>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Transport Operators
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-black text-[#0A1F44] tracking-tight">Transport Company Portal</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Issue waybills in 20 seconds, print digital receipts, verify receiver PINs, and manage park manifests.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowStaffPortalsModal(true)}
              className="w-full bg-[#0A1F44] hover:bg-blue-950 text-white font-black py-3.5 px-4 rounded-2xl text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4 text-[#F2A93B]" />
              <span>Staff &amp; Company Login</span>
            </button>
          </div>
        </div>

        {/* The 3 Trust Pillars */}
        <div className="max-w-2xl mx-auto pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 font-black text-xs text-[#0A1F44]">
                <Lock className="w-4 h-4 text-[#F2A93B]" />
                <span>Secret Pickup PIN</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Cartons are only handed over when the receiver presents their private 4-digit code. No wrongful claims.
              </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 font-black text-xs text-[#0A1F44]">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Digital Receipts</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Instant digital proof of payment. Printable to Bluetooth printers, saveable as PDF, or sent via WhatsApp.
              </p>
            </div>

            <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 font-black text-xs text-[#0A1F44]">
                <Bell className="w-4 h-4 text-blue-600" />
                <span>Arrival Alerts</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Senders and receivers know the minute the vehicle arrives at the destination park without calling the driver.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Staff & Operator Portals Bottom Sheet Modal */}
      {showStaffPortalsModal && (
        <div className="fixed inset-0 bg-[#091026]/80 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-slideUp sm:animate-scaleUp border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Mobile handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto sm:hidden" />

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-[#0A1F44] flex items-center justify-center font-extrabold">
                  <ShieldCheck className="w-5 h-5 text-[#0A1F44]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A1F44]">Transport &amp; Park Portals</h3>
                  <p className="text-xs text-slate-500 font-medium">Select your role to sign in</p>
                </div>
              </div>
              <button
                onClick={() => setShowStaffPortalsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Portal Options */}
            <div className="space-y-2 pt-1">
              {/* Option 1: Park Counter Staff */}
              <button
                type="button"
                onClick={() => {
                  setShowStaffPortalsModal(false);
                  if (activeToken && activeRole === 'staff') {
                    navigate('/staff/dashboard');
                  } else {
                    navigate('/login/staff');
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-[#0A1F44] bg-slate-50/70 hover:bg-blue-50/40 text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#0A1F44] group-hover:text-blue-900">Park Counter Staff</div>
                    <div className="text-[11px] text-slate-500 font-medium">Issue waybills, print receipts &amp; verify pickup PINs</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* Option 2: Park Manager */}
              <button
                type="button"
                onClick={() => {
                  setShowStaffPortalsModal(false);
                  if (activeToken && activeRole === 'manager') {
                    navigate('/manager/dashboard');
                  } else {
                    navigate('/login/manager?role=manager');
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-[#0A1F44] bg-slate-50/70 hover:bg-blue-50/40 text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 font-bold">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#0A1F44] group-hover:text-blue-900">Park Manager / Auditor</div>
                    <div className="text-[11px] text-slate-500 font-medium">Cashier audits, vehicle departures &amp; park control</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* Option 3: Transport Company Fleet */}
              <button
                type="button"
                onClick={() => {
                  setShowStaffPortalsModal(false);
                  if (activeToken && activeRole === 'company') {
                    navigate('/company/dashboard');
                  } else {
                    navigate('/login/company');
                  }
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-[#0A1F44] bg-slate-50/70 hover:bg-blue-50/40 text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold">
                    <Building2 className="w-5 h-5 text-[#F2A93B]" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#0A1F44] group-hover:text-blue-900">Transport Company Owner</div>
                    <div className="text-[11px] text-slate-500 font-medium">Fleet revenue, multi-station reports &amp; records</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>

              {/* Option 4: Driver */}
              <button
                type="button"
                onClick={() => {
                  setShowStaffPortalsModal(false);
                  navigate('/login/driver');
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 hover:border-[#0A1F44] bg-slate-50/70 hover:bg-blue-50/40 text-left transition-all active:scale-[0.99] cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 font-bold">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-[#0A1F44] group-hover:text-blue-900">Driver Portal</div>
                    <div className="text-[11px] text-slate-500 font-medium">Trip waybill manifest &amp; emergency road pass</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowStaffPortalsModal(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* How It Works Guide Modal */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 bg-[#091026]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-[#0A1F44] flex items-center justify-center font-extrabold text-sm">
                  💡
                </div>
                <div>
                  <h3 className="text-base font-black text-[#0A1F44]">How Waybilla Works</h3>
                  <p className="text-xs text-slate-500">Simple 3-step guide for everyone</p>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-3.5 space-y-2">
                <div className="font-extrabold text-[#0A1F44] text-xs flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#F2A93B]" />
                  <span>For Senders &amp; Receivers:</span>
                </div>
                <ul className="space-y-1.5 text-[11px] leading-relaxed pl-1">
                  <li><strong>1. Drop off carton:</strong> Give your phone number at the counter.</li>
                  <li><strong>2. Track anytime:</strong> Enter code on Waybilla to see current park checkpoint.</li>
                  <li><strong>3. Collect with PIN:</strong> Show your secret 4-digit code to collect goods.</li>
                </ul>
              </div>

              <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-3.5 space-y-2">
                <div className="font-extrabold text-amber-950 text-xs flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>For Transport Companies:</span>
                </div>
                <ul className="space-y-1.5 text-[11px] leading-relaxed pl-1">
                  <li><strong>1. Issue Waybills:</strong> Print digital receipts in 20 seconds.</li>
                  <li><strong>2. Update Milestones:</strong> Mark departure and arrival at terminals.</li>
                  <li><strong>3. Stop Theft:</strong> Secret PIN guarantees only the real owner collects goods.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorksModal(false)}
              className="w-full bg-[#0A1F44] text-white font-extrabold py-3 rounded-2xl text-xs hover:bg-blue-900 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-slate-700">
              &copy; {new Date().getFullYear()} Waybilla. Nigeria’s Waybill Tracking Network.
            </p>
            <p className="text-[11px] font-medium text-slate-500">
              A product of <span className="text-slate-800 font-bold">Haxel Tech-Solutions</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHowItWorksModal(true)}
              className="text-xs font-bold text-[#0A1F44] hover:text-amber-600 flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              <HelpCircle className="w-4 h-4 text-[#F2A93B]" />
              <span className="underline decoration-amber-400 underline-offset-4 font-bold">How it Works</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
