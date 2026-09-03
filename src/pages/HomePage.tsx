import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Building2, User, KeyRound, Sparkles, X, HelpCircle, Phone, CheckCircle2, ArrowRight, ShieldCheck, Truck, Receipt, Bell, Eye } from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import { triggerOSNotification } from '../utils/notifications';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [trackingCode, setTrackingCode] = useState('');
  const [trackAlert, setTrackAlert] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackedWaybill, setTrackedWaybill] = useState<any>(null);
  const [trackedRoute, setTrackedRoute] = useState<any>(null);
  const [trackedDriver, setTrackedDriver] = useState<any>(null);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

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
            console.log('[SSE Public Tracking Update Received]:', data);
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
        setTrackAlert(data.error || "Waybill tracking code not found. Please double check the code written on your waybill receipt.");
      } else {
        setTrackedWaybill(data.waybill);
        setTrackedRoute(data.route);
        setTrackedDriver(data.driver);
      }
    } catch (err) {
      console.error("Tracking request failed:", err);
      setTrackAlert("Failed to connect to the server. Please check your connection and try again.");
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
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      {/* Top Header Banner */}
      <header className="bg-[#0A1F44] text-white py-4 px-6 shadow-md border-b-4 border-[#F2A93B]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div 
            onClick={handleSecretTap}
            className="flex items-center gap-3 cursor-pointer select-none"
            title="Waybilla Nigeria"
          >
            <Logo size="md" showText={false} />
            <div className="flex items-center gap-2 font-black text-xl tracking-tight">
              <span>Way<span className="text-[#F2A93B]">billa</span></span>
              {/* Nigerian Flag Badge */}
              <span className="inline-flex items-center shadow-sm rounded overflow-hidden border border-white/20 w-7 h-5 shrink-0" title="Nigeria Flag">
                <svg className="w-full h-full" viewBox="0 0 3 2" role="img" aria-label="Nigeria Flag">
                  <title>Nigeria Flag</title>
                  <rect width="1" height="2" x="0" fill="#008751" />
                  <rect width="1" height="2" x="1" fill="#FFFFFF" />
                  <rect width="1" height="2" x="2" fill="#008751" />
                </svg>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto flex-grow px-6 py-8 flex flex-col justify-center space-y-8">
        {/* Intro */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold shadow-xs">
            <span role="img" aria-label="Nigeria Flag">🇳🇬</span>
            <span>{t('builtForNigeria')}</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-[#0A1F44] tracking-tight leading-tight max-w-md mx-auto">
            {t('heroTitle')}
          </h1>
          
          <p className="text-xs sm:text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
            {t('heroDesc')}
          </p>

          {/* Feature highlights pill badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-[#0A1F44]">
            <span className="bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              {t('liveStatusBadge')}
            </span>
            <span className="bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              {t('digitalReceiptBadge')}
            </span>
          </div>
        </div>

        {/* What is Waybilla Friendly Disclaimer Card */}
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 text-xs text-amber-950 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
            <span>{t('quickNoticeTitle')}</span>
          </div>
          <p className="leading-relaxed font-medium">
            {t('whatIsWaybilla')}
          </p>
          <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200 text-amber-900 text-[11px] font-semibold leading-relaxed">
            🤣 {t('noForeignCodes')}
          </div>
        </div>

        {/* Track Box Section */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-lg space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider flex items-center justify-between">
              <span>{t('trackWaybill')}</span>
              <span className="text-[11px] text-slate-400 font-normal">e.g. NNW-6530</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              {t('trackSub')}
            </p>
          </div>
          
          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-grow">
              <label htmlFor="tracking-code-input" className="sr-only">Waybill Tracking Code</label>
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                <Search className="w-5 h-5" />
              </span>
              <input
                id="tracking-code-input"
                name="trackingCode"
                type="text"
                placeholder={t('enterTrackingNum')}
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-sm sm:text-base font-semibold placeholder-slate-400 outline-none uppercase transition-all"
                aria-label="Enter waybill tracking code to track your waybill"
              />
            </div>
            <button
              type="submit"
              disabled={isTracking}
              className="bg-[#F2A93B] hover:bg-[#d9922b] disabled:bg-amber-300 text-[#0A1F44] font-extrabold px-6 py-4 rounded-2xl text-sm transition-all shadow-sm active:scale-[0.97] cursor-pointer flex items-center justify-center shrink-0 min-h-[48px]"
              aria-label="Track Waybill"
            >
              {isTracking ? 'Tracking...' : t('trackBtn')}
            </button>
          </form>

          <div className="bg-blue-50/80 border border-blue-100 rounded-2xl p-3 text-xs text-slate-700 flex items-center justify-between gap-2">
            <span className="text-[11px] leading-relaxed text-slate-700">
              💡 <strong>Want to see all waybills linked to your phone number?</strong> Log in to the <strong>Customer Portal</strong> below to view all your receipts & Pickup PINs!
            </span>
          </div>

          {trackAlert && (
            <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-1">
              <div>{trackAlert}</div>
              <p className="text-[11px] text-rose-700 font-normal pt-1">
                💡 Tip: Verify the code printed on the receipt issued to you at the motor park counter.
              </p>
            </div>
          )}
        </div>

        {/* Tracked Shipment Details View */}
        {trackedWaybill && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                {t('searchResult')}
              </h3>
              <button 
                onClick={handleClearTrack}
                className="flex items-center gap-1 text-xs font-extrabold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-all min-h-[44px]"
                aria-label="Clear track details"
              >
                <X className="w-3.5 h-3.5" />
                {t('clearResult')}
              </button>
            </div>
            <ShipmentTimeline waybill={trackedWaybill} route={trackedRoute} driver={trackedDriver} showReceiptButton={false} />
          </div>
        )}

        {/* Portal Entry Channels */}
        <div className="space-y-4">
          {/* Main Customer Portal Banner */}
          <div className="bg-gradient-to-br from-[#0A1F44] to-[#122e60] rounded-3xl p-6 text-white shadow-md space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#F2A93B] text-[#0A1F44] flex items-center justify-center font-black text-xl shadow-sm">
                  📱
                </div>
                <div>
                  <h3 className="font-extrabold text-base">{t('customerPortal')}</h3>
                  <p className="text-xs text-amber-200">{t('customerSub')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 p-3.5 rounded-2xl text-xs text-slate-100 space-y-1.5 border border-white/10">
              <p className="font-bold text-amber-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {t('howToLoginTitle')}
              </p>
              <p className="leading-relaxed">
                {t('howToLoginDesc')}
              </p>
            </div>

            <button
              onClick={() => navigate('/login/customer')}
              className="w-full bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-black py-3.5 px-5 rounded-2xl text-sm transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              aria-label="Go to Customer Portal"
            >
              <span>{t('loginSignUpCustomer')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Secondary Compact Operator Links (Staff & Transport Company) */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-center gap-2.5 text-sm text-slate-700">
            <span className="text-xs font-bold text-slate-600">{t('parkStaffOperators')}</span>
            
            <button
              onClick={() => navigate('/login/staff')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0A1F44] font-extrabold text-xs transition-colors cursor-pointer min-h-[44px]"
              aria-label="Staff Login"
            >
              <KeyRound className="w-4 h-4 text-slate-700" />
              <span>{t('staffPortal')}</span>
            </button>

            <button
              onClick={() => navigate('/login/manager?role=manager')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0A1F44] font-extrabold text-xs transition-colors cursor-pointer min-h-[44px]"
              aria-label="Manager Login"
            >
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <span>{t('managerPortal')}</span>
            </button>

            <button
              onClick={() => navigate('/login/manager?role=trip_monitor')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0A1F44] font-extrabold text-xs transition-colors cursor-pointer min-h-[44px]"
              aria-label="Trip Monitor Login"
            >
              <Eye className="w-4 h-4 text-slate-700" />
              <span>{t('tripMonitorPortal')}</span>
            </button>

            <button
              onClick={() => navigate('/login/manager?role=driver')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0A1F44] font-extrabold text-xs transition-colors cursor-pointer min-h-[44px]"
              aria-label="Driver Login"
            >
              <Truck className="w-4 h-4 text-slate-700" />
              <span>{t('driverPortal')}</span>
            </button>

            <button
              onClick={() => navigate('/login/company')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#0A1F44] font-extrabold text-xs transition-colors cursor-pointer min-h-[44px]"
              aria-label="Company Portal Login"
            >
              <Building2 className="w-4 h-4 text-slate-700" />
              <span>{t('companyPortal')}</span>
            </button>
          </div>
        </div>
      </main>

      {/* How It Works Guide Modal */}
      {showHowItWorksModal && (
        <div className="fixed inset-0 bg-[#091026]/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-[#0A1F44] flex items-center justify-center font-extrabold">
                  💡
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#0A1F44]">{t('howItWorks')}</h3>
                  <p className="text-xs text-slate-500">{t('howWorksSubtitle')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowHowItWorksModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* For Customers */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div className="font-extrabold text-[#0A1F44] text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-[#F2A93B]" />
                  <span>{t('forCustomersTitle')}</span>
                </div>
                
                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-blue-100">
                    <span className="font-black text-blue-700">1.</span>
                    <p>{t('custStep1')}</p>
                  </div>

                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-blue-100">
                    <span className="font-black text-blue-700">2.</span>
                    <p>{t('custStep2')}</p>
                  </div>

                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-blue-100">
                    <span className="font-black text-blue-700">3.</span>
                    <p>{t('custStep3')}</p>
                  </div>
                </div>
              </div>

              {/* For Park Staff */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="font-extrabold text-amber-950 text-sm flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-600" />
                  <span>{t('forStaffTitle')}</span>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-amber-100">
                    <span className="font-black text-amber-700">1.</span>
                    <p>{t('staffStep1')}</p>
                  </div>

                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-amber-100">
                    <span className="font-black text-amber-700">2.</span>
                    <p>{t('staffStep2')}</p>
                  </div>

                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-amber-100">
                    <span className="font-black text-amber-700">3.</span>
                    <p>{t('staffStep3')}</p>
                  </div>

                  <div className="flex items-start gap-2 bg-white p-2.5 rounded-xl border border-amber-100">
                    <span className="font-black text-amber-700">4.</span>
                    <p>{t('staffStep4')}</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHowItWorksModal(false)}
              className="w-full bg-[#0A1F44] text-white font-bold py-3 rounded-2xl text-sm hover:bg-blue-900 transition-colors cursor-pointer"
            >
              {t('gotItClose')}
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">
              &copy; {new Date().getFullYear()} {t('copyrightText')}
            </p>
            <p className="text-[11px] font-medium text-slate-600">
              Waybilla is a product of <span className="text-slate-900 font-bold">Haxel Tech-Solutions</span>
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowHowItWorksModal(true)}
              className="text-xs font-bold text-[#0A1F44] hover:text-amber-600 flex items-center gap-1.5 transition-colors cursor-pointer bg-transparent border-0 p-0"
            >
              <HelpCircle className="w-4 h-4 text-[#F2A93B]" />
              <span className="underline decoration-amber-400 underline-offset-4 font-bold">FAQ / How it works</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

