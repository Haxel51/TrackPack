import React from 'react';
import { Truck, Package, LogOut, ArrowRight, ShieldCheck, MapPin, Building2, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';

interface ModuleSelectionScreenProps {
  userName?: string;
  companyName?: string;
  userRole?: string;
  onSelectModule: (module: 'fleet' | 'waybill') => void;
  onLogout: () => void;
}

export const ModuleSelectionScreen: React.FC<ModuleSelectionScreenProps> = ({
  userName,
  companyName,
  userRole,
  onSelectModule,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans">
      
      {/* Top Bar Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-9 w-auto text-white" />
            <div className="hidden sm:block h-5 w-[1px] bg-slate-800" />
            <span className="hidden sm:inline-block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Workspace Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            {(companyName || userName) && (
              <div className="text-right hidden xs:block">
                <p className="text-sm font-extrabold text-white leading-tight">
                  {companyName || userName}
                </p>
                {userRole && (
                  <p className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
                    {userRole} Account
                  </p>
                )}
              </div>
            )}

            <button
              onClick={onLogout}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all border border-slate-700 cursor-pointer shadow-sm active:scale-95"
              id="logout-module-btn"
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 flex flex-col justify-center">
        
        {/* Title Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-extrabold uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Select Workspace Module</span>
          </div>
          
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Where would you like to work today?
          </h1>
          
          <p className="text-base sm:text-lg text-slate-400 font-normal leading-relaxed">
            Choose an operational module below to access your dedicated dashboard.
            Your selection will be remembered automatically.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-5xl mx-auto w-full">
          
          {/* Card 1: Fleet Tracking */}
          <div
            onClick={() => onSelectModule('fleet')}
            className="group relative bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-slate-800 hover:border-amber-500/70 rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
            id="select-module-fleet-card"
          >
            {/* Top Accent Light Beam */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 opacity-80 group-hover:opacity-100 transition-opacity" />
            
            <div className="space-y-6">
              
              {/* Module Header & Icon */}
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-slate-950 transition-all duration-300 shadow-lg shadow-amber-500/10">
                  <span className="text-3xl">🚛</span>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full group-hover:bg-amber-500/20">
                  Logistics & Trips
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-amber-400 transition-colors">
                  Fleet Tracking
                </h2>
                <p className="text-sm sm:text-base text-slate-300 font-medium mt-2 leading-relaxed">
                  Manage truck trips, track drivers and monitor deliveries
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Garage Origin & Geofenced Locations</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Supplier & Customer Destination Tracking</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Real-Time Driver Trips & Delivery Verification</span>
                </div>
              </div>

            </div>

            {/* Launch CTA Button */}
            <div className="mt-8 pt-4">
              <button
                type="button"
                className="w-full bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black py-4 px-6 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer border-0"
                id="btn-launch-fleet"
              >
                <span>Launch Fleet Tracking</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Card 2: Waybill */}
          <div
            onClick={() => onSelectModule('waybill')}
            className="group relative bg-gradient-to-b from-slate-900 to-slate-900/90 border-2 border-slate-800 hover:border-blue-500/70 rounded-3xl p-8 sm:p-10 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 cursor-pointer overflow-hidden"
            id="select-module-waybill-card"
          >
            {/* Top Accent Light Beam */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 opacity-80 group-hover:opacity-100 transition-opacity" />

            <div className="space-y-6">
              
              {/* Module Header & Icon */}
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300 shadow-lg shadow-blue-500/10">
                  <span className="text-3xl">📦</span>
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest bg-blue-500/10 border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full group-hover:bg-blue-500/20">
                  Branches & Dispatches
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
                  Waybill
                </h2>
                <p className="text-sm sm:text-base text-slate-300 font-medium mt-2 leading-relaxed">
                  Manage shipments, dispatches and park branches
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Motor Park Branches & Staff Accounts</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Waybill Dispatches & Package Tracking</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Automated Revenue Split & Settlements</span>
                </div>
              </div>

            </div>

            {/* Launch CTA Button */}
            <div className="mt-8 pt-4">
              <button
                type="button"
                className="w-full bg-blue-600 group-hover:bg-blue-500 text-white font-black py-4 px-6 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer border-0"
                id="btn-launch-waybill"
              >
                <span>Launch Waybill Module</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Switch Module Tip */}
        <div className="mt-12 text-center text-xs text-slate-500 font-medium max-w-lg mx-auto bg-slate-900/40 border border-slate-800/60 p-4 rounded-2xl">
          💡 <span className="text-slate-400">Pro Tip:</span> You can switch modules at any time by clicking the <strong className="text-slate-200 font-bold">"Switch Module"</strong> button in the top navigation bar of your workspace.
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-6 text-center text-xs text-slate-600">
        Waybilla Enterprise Operating System • All rights reserved
      </footer>

    </div>
  );
};
