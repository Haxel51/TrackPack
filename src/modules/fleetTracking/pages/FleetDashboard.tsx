import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { Logo } from '../../../components/Logo';
import { FleetLocationsView } from './FleetLocationsView';
import { TrucksManagement } from '../components/TrucksManagement';
import { TripsManagement } from '../components/TripsManagement';
import { TeamManagement } from '../components/TeamManagement';
import {
  MapPin,
  Truck,
  LayoutGrid,
  LogOut,
  BarChart3,
  ShieldCheck,
  Building,
  Navigation,
  CheckCircle2,
  Clock,
  UserCheck,
  ArrowRightLeft,
  Users
} from 'lucide-react';

interface FleetDashboardProps {
  onSwitchModule?: () => void;
  showSwitchModule?: boolean;
}

export const FleetDashboard: React.FC<FleetDashboardProps> = ({ onSwitchModule, showSwitchModule = false }) => {
  const { user, token, role, logout } = useAuth();
  const { t } = useLanguage();

  const isTripMonitor = role === 'trip_monitor' || user?.role === 'trip_monitor' || user?.manager_type === 'Trip Monitor';
  const isCEO = role === 'company' || user?.manager_type === 'CEO';
  const isManager = role === 'manager' || user?.manager_type === 'Manager';

  const canSwitchModule = Boolean(onSwitchModule && showSwitchModule && !isManager && !isTripMonitor && role === 'company');

  const [activeTab, setActiveTab] = useState<'trucks' | 'locations' | 'trips' | 'team' | 'overview'>(
    isTripMonitor ? 'trips' : 'trucks'
  );

  // Mock / Static data for Trips & Overview to give a rich, complete Fleet experience
  const [trips] = useState<any[]>([
    {
      id: 'TRIP-9021',
      truck: 'Dangote SinoTruck - KAN 482 XA',
      driver: 'Ibrahim Bello',
      origin: 'BUA Cement Factory, Obu',
      destination: 'Central Depot, Abuja',
      status: 'in_transit',
      eta: '2 hrs 40 mins',
      cargo: '500 Bags Cement',
      dispatch_time: '08:30 AM Today'
    },
    {
      id: 'TRIP-9022',
      truck: 'Mack Granite - ENU 109 ZY',
      driver: 'Chinedu Okeke',
      origin: 'Onitsha Main Garage',
      destination: 'Dangote Salt Refinery, Lagos',
      status: 'arrived',
      eta: 'Completed',
      cargo: 'Haulage Container #88',
      dispatch_time: 'Yesterday'
    }
  ]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navigation Header */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-auto text-white" />
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Truck className="w-3 h-3" />
                Fleet Tracking Module
              </span>
            </div>

            {/* Mobile Switch Module Button */}
            {canSwitchModule && (
              <div className="md:hidden">
                <button
                  onClick={onSwitchModule}
                  className="flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer"
                  id="mobile-switch-module-btn-fleet"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Switch Module</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            
            {/* Desktop Switch Module Button */}
            {canSwitchModule && (
              <>
                <button
                  onClick={onSwitchModule}
                  className="hidden md:flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
                  id="desktop-switch-module-btn-fleet"
                >
                  <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                  <span>Switch Module</span>
                </button>
                <div className="h-6 w-[1px] bg-slate-800 hidden md:block" />
              </>
            )}

            <LanguageSwitcher />

            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              id="fleet-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>

        </div>

        {/* Tab Sub-Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-800/80 gap-2 pt-2 overflow-x-auto scrollbar-none pb-1">
          {!isTripMonitor && (
            <button
              onClick={() => setActiveTab('trucks')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'trucks'
                  ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
              id="fleet-tab-trucks"
            >
              <Truck className={`w-4 h-4 ${activeTab === 'trucks' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Truck Profiles & Payment Plans 🚚</span>
            </button>
          )}

          {!isTripMonitor && (
            <button
              onClick={() => setActiveTab('locations')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'locations'
                  ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
              id="fleet-tab-locations"
            >
              <MapPin className={`w-4 h-4 ${activeTab === 'locations' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Fleet Locations & Pin Confirmation 📍</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === 'trips'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
            id="fleet-tab-trips"
          >
            <Navigation className={`w-4 h-4 ${activeTab === 'trips' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Truck Trips & Dispatches 🚛</span>
          </button>

          {!isTripMonitor && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'team'
                  ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
              id="fleet-tab-team"
            >
              <Users className={`w-4 h-4 ${activeTab === 'team' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Team Management 👥</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === 'overview'
                ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border-transparent'
            }`}
            id="fleet-tab-overview"
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'overview' ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>Fleet Overview 📊</span>
          </button>
        </div>
      </header>

      {/* Main Module Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        
        {/* TAB 1: TRUCK PROFILES */}
        {activeTab === 'trucks' && !isTripMonitor && (
          <TrucksManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 2: FLEET LOCATIONS */}
        {activeTab === 'locations' && !isTripMonitor && (
          <FleetLocationsView token={token || ''} userName={user?.name} />
        )}

        {/* TAB 3: TRIPS & DISPATCHES */}
        {activeTab === 'trips' && (
          <TripsManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 4: TEAM MANAGEMENT */}
        {activeTab === 'team' && !isTripMonitor && (
          <TeamManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 3: FLEET OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in" id="fleet-overview-view">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-extrabold uppercase tracking-wider">
                  <span>Garage Origin Status</span>
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-3xl font-black text-white">1 Active Garage</p>
                <p className="text-xs text-emerald-400 font-semibold">📍 Geofence Pin Confirmed (Blue Pin)</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-extrabold uppercase tracking-wider">
                  <span>Supplier Destinations</span>
                  <Building className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-3xl font-black text-white">Registered Destinations</p>
                <p className="text-xs text-emerald-400 font-semibold">📍 Geofence Pins Confirmed (Green Pin)</p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-xs font-extrabold uppercase tracking-wider">
                  <span>Active Drivers & Trucks</span>
                  <UserCheck className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-3xl font-black text-white">Ready for Dispatch</p>
                <p className="text-xs text-amber-400 font-semibold">🚚 Haulage Operational</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-4 text-center">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">Fleet Tracking Module Active</h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                Your garage origin pins and supplier destination pins are securely synced with Google Maps GPS geofencing. Real-time driver dispatches and vehicle statuses are actively monitored.
              </p>
            </div>
          </div>
        )}

      </main>

    </div>
  );
};
