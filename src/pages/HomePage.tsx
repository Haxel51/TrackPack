import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Building2, User, KeyRound, Sparkles, X } from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const [trackAlert, setTrackAlert] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackedWaybill, setTrackedWaybill] = useState<any>(null);
  const [trackedRoute, setTrackedRoute] = useState<any>(null);
  const [trackedDriver, setTrackedDriver] = useState<any>(null);

  const [secretTaps, setSecretTaps] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

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
    setTrackAlert(null);
    setTrackedWaybill(null);
    setTrackedRoute(null);
    setTrackedDriver(null);

    const code = trackingCode.trim().toUpperCase();
    if (!code) {
      setTrackAlert("Please enter a tracking code.");
      return;
    }

    setIsTracking(true);
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(code)}`);
      const data = await response.json();
      if (!response.ok) {
        setTrackAlert(data.error || "An error occurred while tracking. Please try again.");
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
      <header className="bg-[#0A1F44] text-white py-6 px-6 shadow-md border-b-4 border-[#F2A93B]">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div 
            onClick={handleSecretTap}
            className="flex items-center gap-2 cursor-pointer select-none"
            title="TrackPack Nigeria"
          >
            <Package className="text-[#F2A93B] w-7 h-7" />
            <div className="flex items-center gap-2 font-extrabold text-xl tracking-wider">
              <span>TrackPack</span>
              <span className="inline-flex items-center shadow-xs rounded overflow-hidden border border-white/20" title="Nigeria">
                <svg className="w-6 h-4" viewBox="0 0 3 2" role="img" aria-label="Nigeria Flag">
                  <title>Nigeria Flag</title>
                  <rect width="1" height="2" x="0" fill="#008751" />
                  <rect width="1" height="2" x="1" fill="#FFFFFF" />
                  <rect width="1" height="2" x="2" fill="#008751" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto flex-grow px-6 py-8 flex flex-col justify-center space-y-8">
        {/* Intro */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-extrabold shadow-xs">
            <span role="img" aria-label="Nigeria Flag">🇳🇬</span>
            <span>Built for Nigeria Interstate Motor Parks</span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-black text-[#0A1F44] tracking-tight leading-tight max-w-md mx-auto">
            Nigeria's #1 Dedicated Waybill Live Tracking Platform
          </h1>
          
          <p className="text-sm font-bold text-[#0A1F44] max-w-md mx-auto">
            Never wonder where your waybill is again.
          </p>

          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            TrackPack specializes exclusively in real-time motor park waybill tracking for interstate shipments across Nigeria (Peace Mass, GUO, God is Good, Young Shall Grow, Goodness & Mercy, Romchi, and local transport lines).
          </p>

          {/* Feature highlights pill badges */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-[#0A1F44]">
            <span className="bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              <span role="img" aria-label="lightning bolt">⚡</span> Live Status Updates
            </span>
            <span className="bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              <span role="img" aria-label="package">📦</span> Digital Waybill Receipts
            </span>
            <span className="bg-white border border-slate-200 px-3 py-1 rounded-full shadow-xs flex items-center gap-1">
              <span role="img" aria-label="bus">🚌</span> Assigned Driver Info
            </span>
          </div>
        </div>

        {/* Track Box Section */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-lg space-y-4">
          <h2 className="text-sm font-extrabold text-[#0A1F44] uppercase tracking-wider">
            Track a Package
          </h2>
          
          <form onSubmit={handleTrackSubmit} className="relative">
            <label htmlFor="tracking-code-input" className="sr-only">Waybill Tracking Code</label>
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              id="tracking-code-input"
              name="trackingCode"
              type="text"
              placeholder="Enter waybill tracking code..."
              value={trackingCode}
              onChange={(e) => setTrackingCode(e.target.value)}
              className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4.5 pl-12 pr-28 text-base font-semibold placeholder-slate-400 outline-none uppercase transition-all"
              aria-label="Enter waybill tracking code to track your package"
            />
            <button
              type="submit"
              disabled={isTracking}
              className="absolute right-2 top-2 bottom-2 bg-[#F2A93B] hover:bg-[#d9922b] disabled:bg-amber-300 text-[#0A1F44] font-extrabold px-5 rounded-xl text-sm transition-all shadow-sm active:scale-[0.97] cursor-pointer flex items-center justify-center"
              aria-label="Track Waybill"
            >
              {isTracking ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {trackAlert && (
            <div className="bg-amber-50 border border-amber-200 text-[#0A1F44] p-4.5 rounded-2xl text-xs font-bold leading-relaxed space-y-1">
              <div>{trackAlert}</div>
            </div>
          )}
        </div>

        {/* Tracked Shipment Details View */}
        {trackedWaybill && (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                Search Result
              </h3>
              <button 
                onClick={handleClearTrack}
                className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
            <ShipmentTimeline waybill={trackedWaybill} route={trackedRoute} driver={trackedDriver} />
          </div>
        )}

        {/* Portal Entry Channels */}
        <div className="space-y-4">
          {/* Main Customer Portal Banner */}
          <button
            onClick={() => navigate('/login/customer')}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-[#0A1F44] font-bold p-5 rounded-2xl transition-all shadow-sm active:scale-[0.99] cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F2A93B] flex items-center justify-center group-hover:scale-105 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-extrabold text-base">Customer Portal</p>
                <p className="text-xs font-normal text-slate-400">Track, pay & collect waybills</p>
              </div>
            </div>
            <span className="text-slate-300 group-hover:text-[#F2A93B] text-lg font-bold transition-colors">→</span>
          </button>

          {/* Secondary Compact Operator Links (Staff & Transport Company) */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
            <span className="text-[11px] font-semibold text-slate-400">Park Operations:</span>
            
            <button
              onClick={() => navigate('/login/staff')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0A1F44] font-bold text-xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Staff Login</span>
            </button>

            <button
              onClick={() => navigate('/login/company')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0A1F44] font-bold text-xs transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Company Portal</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 text-center border-t border-slate-100 bg-white">
        <p className="text-xs text-slate-400">
          &copy; {new Date().getFullYear()} TrackPack Nigeria. Robust motor park tracking solutions.
        </p>
      </footer>
    </div>
  );
};
