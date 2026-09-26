import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { Logo } from '../../../components/Logo';
import { TrucksManagement } from '../components/TrucksManagement';
import { TripsManagement } from '../components/TripsManagement';
import { TeamManagement } from '../components/TeamManagement';
import { PaymentHistoryView } from '../components/PaymentHistoryView';
import { FleetAnalyticsManagement } from '../components/FleetAnalyticsManagement';
import { NotificationCenterModal, FleetNotification } from '../components/NotificationCenterModal';
import { FleetPushNotificationCard } from '../components/FleetPushNotificationCard';
import { initializeFCM, requestNotificationPermission, isIframeContext } from '../fcm';
import { getFleetNotifications } from '../api';
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
  ArrowRight,
  Users,
  CreditCard,
  Bell,
  BellOff,
  X
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

  const canSwitchModule = Boolean(onSwitchModule && (!isTripMonitor));

  const [activeTab, setActiveTab] = useState<'trucks' | 'trips' | 'team' | 'overview' | 'analytics'>(
    'overview'
  );

  const [notifications, setNotifications] = useState<FleetNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [foregroundToast, setForegroundToast] = useState<{ title: string; body: string; data?: any } | null>(null);
  const isInIframe = isIframeContext();

  const isDriver = role === 'driver' || user?.role === 'driver' || user?.manager_type === 'Driver';
  const isEligibleForPush = !isDriver && (isCEO || isManager || isTripMonitor || role === 'company' || role === 'manager' || role === 'trip_monitor');

  const fetchNotifications = useCallback(async () => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('company_token') || localStorage.getItem('manager_token') : null);
      if (!activeToken) return;
      const res = await getFleetNotifications(activeToken);
      if (res.success && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (e) {
      // Graceful fallback for offline / disconnected states
    }
  }, [token]);

  const handleEnableNotifications = async () => {
    const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') : null);
    const perm = await requestNotificationPermission(activeToken || undefined, user?.id || user?.owner_phone);
    if (perm !== 'unsupported' && perm !== 'iframe_blocked') {
      setNotifPermission(perm);
    }
    if (perm === 'granted') {
      fetchNotifications();
    }
  };

  // Automatically request notification permissions on mount for CEO/Manager/Trip Monitor
  useEffect(() => {
    if (isEligibleForPush && notifPermission === 'default' && !isInIframe) {
      handleEnableNotifications();
    }
  }, [isEligibleForPush, notifPermission, isInIframe]);

  // Check URL parameters when app was opened from notification tap
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get('tripId');
    if (tripId) {
      setActiveTab('trips');
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  // Listen for foreground notifications
  useEffect(() => {
    const handleForegroundEvent = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setForegroundToast({
          title: detail.title || 'Fleet Notification 🚚',
          body: detail.body || '',
          data: detail.data
        });
        fetchNotifications();
      }
    };

    window.addEventListener('fleet_foreground_notification', handleForegroundEvent);
    return () => {
      window.removeEventListener('fleet_foreground_notification', handleForegroundEvent);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('company_token') || localStorage.getItem('manager_token') : null);
    if (activeToken) {
      initializeFCM(activeToken, user?.id || user?.owner_phone);
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [token, fetchNotifications, user?.id, user?.owner_phone]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Navigation Header - Signature Deep Navy Executive Bar */}
      <header className="bg-[#0A1F44] border-b border-[#15346A] sticky top-0 z-40 shadow-lg text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-auto text-white" />
              <span className="bg-[#F7941D]/20 text-[#F7941D] border border-[#F7941D]/40 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                <Truck className="w-3 h-3 text-[#F7941D]" />
                {t('fleetModuleBadge') || 'Fleet & Assets'}
              </span>
            </div>

            {/* Mobile Switch Module Button */}
            {canSwitchModule && (
              <div className="md:hidden">
                <button
                  onClick={onSwitchModule}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-[#F7941D] border border-[#F7941D]/30 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                  id="mobile-switch-module-btn-fleet"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-[#F7941D]" />
                  <span>{t('switchModule')}</span>
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
                  className="hidden md:flex items-center gap-2 bg-white/10 hover:bg-white/20 text-[#F7941D] border border-[#F7941D]/30 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                  id="desktop-switch-module-btn-fleet"
                >
                  <ArrowRightLeft className="w-4 h-4 text-[#F7941D]" />
                  <span>{t('switchModule')}</span>
                </button>
                <div className="h-6 w-[1px] bg-white/20 hidden md:block" />
              </>
            )}

            <LanguageSwitcher />

            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer"
              title="Fleet Notifications"
              id="fleet-notification-bell-btn"
            >
              <Bell className="w-4 h-4 text-[#F7941D]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center animate-bounce shadow-md border-2 border-[#0A1F44]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-400/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              id="fleet-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-300" />
              <span>{t('signOut')}</span>
            </button>
          </div>

        </div>

        {/* Tab Sub-Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-white/10 gap-2 pt-2 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === 'overview'
                ? 'bg-white/15 text-[#F7941D] border-[#F7941D] shadow-sm'
                : 'text-slate-300 hover:text-white border-transparent hover:bg-white/5'
            }`}
            id="fleet-tab-overview"
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'overview' ? 'text-[#F7941D]' : 'text-slate-400'}`} />
            <span>{t('fleetOverviewTab')}</span>
          </button>

          {!isTripMonitor && (
            <button
              onClick={() => setActiveTab('trucks')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'trucks'
                  ? 'bg-white/15 text-[#F7941D] border-[#F7941D] shadow-sm'
                  : 'text-slate-300 hover:text-white border-transparent hover:bg-white/5'
              }`}
              id="fleet-tab-trucks"
            >
              <Truck className={`w-4 h-4 ${activeTab === 'trucks' ? 'text-[#F7941D]' : 'text-slate-400'}`} />
              <span>{t('fleetTrucksTab') || 'Trucks & GPS Assets'}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
              activeTab === 'trips'
                ? 'bg-white/15 text-[#F7941D] border-[#F7941D] shadow-sm'
                : 'text-slate-300 hover:text-white border-transparent hover:bg-white/5'
            }`}
            id="fleet-tab-trips"
          >
            <Navigation className={`w-4 h-4 ${activeTab === 'trips' ? 'text-[#F7941D]' : 'text-slate-400'}`} />
            <span>{t('fleetTripsTab') || 'Trips & Tracking'}</span>
          </button>

          {!isTripMonitor && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'team'
                  ? 'bg-white/15 text-[#F7941D] border-[#F7941D] shadow-sm'
                  : 'text-slate-300 hover:text-white border-transparent hover:bg-white/5'
              }`}
              id="fleet-tab-team"
            >
              <Users className={`w-4 h-4 ${activeTab === 'team' ? 'text-[#F7941D]' : 'text-slate-400'}`} />
              <span>{t('fleetTeamTab')}</span>
            </button>
          )}

          {(isCEO || isManager) && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-white/15 text-[#F7941D] border-[#F7941D] shadow-sm'
                  : 'text-slate-300 hover:text-white border-transparent hover:bg-white/5'
              }`}
              id="fleet-tab-analytics"
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-[#F7941D]' : 'text-slate-400'}`} />
              <span>Analytics & Reports</span>
            </button>
          )}
        </div>
      </header>

      {/* Foreground Toast Notification Banner */}
      {foregroundToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-white border border-orange-300 shadow-2xl rounded-2xl p-4 text-slate-900 animate-fade-in flex items-start gap-3">
          <div className="p-2.5 bg-orange-100 text-orange-600 rounded-xl shrink-0 mt-0.5">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-orange-800">{foregroundToast.title}</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{foregroundToast.body}</p>
          </div>
          <button
            onClick={() => setForegroundToast(null)}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Module Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        
        {/* TAB 1: TRUCK PROFILES */}
        {activeTab === 'trucks' && !isTripMonitor && (
          <TrucksManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 2: TRIPS & DISPATCHES */}
        {activeTab === 'trips' && (
          <TripsManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 3: TEAM MANAGEMENT */}
        {activeTab === 'team' && !isTripMonitor && (
          <TeamManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 4: ANALYTICS & REPORTS */}
        {activeTab === 'analytics' && (isCEO || isManager) && (
          <FleetAnalyticsManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB: FLEET OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in" id="fleet-overview-view">
            <FleetPushNotificationCard />

            {/* EXECUTIVE HERO BANNER */}
            <div className="bg-gradient-to-br from-[#0A1F44] via-[#0E2756] to-[#15346A] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-[#1E3E7B] flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="bg-[#F7941D]/20 text-[#F7941D] border border-[#F7941D]/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                    Universal GPS & Magnetic Fleet Telemetry
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    Live System Active
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Fleet & Haulage Operations Center
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Real-time GPS tracking for trucks, fuel tankers, and cargo haulage. Instant customer live tracking links, turn-by-turn road routes, driver calling, and 1-tap mid-transit redirection.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  onClick={() => setActiveTab('trips')}
                  className="flex-1 sm:flex-initial bg-[#F7941D] hover:bg-[#e08215] text-[#0A1F44] font-black px-5 py-3 rounded-2xl text-xs transition-all shadow-md shadow-[#F7941D]/25 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Dispatch Trip</span>
                </button>
                <button
                  onClick={() => setActiveTab('trucks')}
                  className="flex-1 sm:flex-initial bg-white/10 hover:bg-white/20 text-[#F7941D] font-bold px-4 py-3 rounded-2xl text-xs transition-all border border-[#F7941D]/30 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Truck className="w-4 h-4 text-[#F7941D]" />
                  <span>+ Register Truck / GPS</span>
                </button>
              </div>
            </div>

            {/* 3 STREAMLINED STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              <div 
                onClick={() => setActiveTab('trips')}
                className="bg-white border border-slate-200 hover:border-[#F7941D] rounded-3xl p-6 space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                  <span className="group-hover:text-[#0A1F44] transition-colors">1. Live Road Telemetry</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-all">
                    <Navigation className="w-4.5 h-4.5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">Active Dispatches</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-purple-600 font-bold flex items-center gap-1">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Customer Link & Road Route</span>
                  </span>
                  <span className="text-[#0A1F44] font-black group-hover:translate-x-0.5 transition-transform flex items-center gap-1">Open &rarr;</span>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('trucks')}
                className="bg-white border border-slate-200 hover:border-[#F7941D] rounded-3xl p-6 space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                  <span className="group-hover:text-[#0A1F44] transition-colors">2. Fleet & Trackers</span>
                  <div className="p-2 rounded-xl bg-[#0A1F44] text-[#F7941D] group-hover:bg-[#15346A] transition-all">
                    <Truck className="w-4.5 h-4.5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">GPS & Drivers</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[#0A1F44] font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Assigned Drivers & IMEI</span>
                  </span>
                  <span className="text-[#0A1F44] font-black group-hover:translate-x-0.5 transition-transform flex items-center gap-1">Manage &rarr;</span>
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('trips')}
                className="bg-white border border-slate-200 hover:border-[#F7941D] rounded-3xl p-6 space-y-3 shadow-xs hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500 text-xs font-extrabold uppercase tracking-wider">
                  <span className="group-hover:text-[#0A1F44] transition-colors">3. Proof of Delivery</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-all">
                    <CheckCircle2 className="w-4.5 h-4.5" />
                  </div>
                </div>
                <p className="text-2xl font-black text-slate-900">Digital e-POD</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Arrival Audit Trail</span>
                  </span>
                  <span className="text-[#0A1F44] font-black group-hover:translate-x-0.5 transition-transform flex items-center gap-1">View &rarr;</span>
                </div>
              </div>

            </div>

            {/* UNIVERSAL TRACKER COMPATIBILITY CALLOUT */}
            <div className="bg-gradient-to-r from-amber-50/60 via-slate-50 to-amber-50/60 border border-amber-200/80 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#0A1F44] text-[#F7941D] rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-md">
                  🛰️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-slate-900">Universal GPS Hardware Compatibility</h4>
                    <span className="bg-[#0A1F44] text-[#F7941D] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">All Brands</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 max-w-2xl font-medium leading-relaxed">
                    Waybilla works seamlessly with all commercial magnetic GPS devices (TK905, TK915, SinoTrack ST-905, GF07, Coban, Micodus, and Satellite trackers). Simply enter the 15-digit IMEI or scan the body barcode.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('trucks')}
                className="bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all cursor-pointer shrink-0 shadow-xs flex items-center gap-2"
              >
                <span>Pair New GPS Tracker</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#F7941D]" />
              </button>
            </div>
          </div>
        )}

      </main>

      <NotificationCenterModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        token={token}
        notifications={notifications}
        onRefresh={fetchNotifications}
        onMarkAllRead={() => {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        }}
        onMarkSingleRead={(id) => {
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        }}
        onSelectTrip={() => {
          setActiveTab('trips');
        }}
        onSelectTruck={() => {
          setActiveTab('trucks');
        }}
      />

      {/* Notification Settings Instruction Modal for Denied Permission */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 text-slate-900 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <BellOff className="w-5 h-5 text-orange-600" />
                <h3 className="font-extrabold text-sm">How to Enable Fleet Alerts</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                Your browser or phone currently blocks notifications for this app. To receive real-time fleet trip & payment updates on your phone:
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-slate-700 font-medium">
                <li>Click the <strong>🔒 Lock icon</strong> or <strong>Site Settings icon</strong> next to the URL address bar.</li>
                <li>Find <strong>Notifications</strong> in the permissions list.</li>
                <li>Switch the setting to <strong>Allow</strong>.</li>
                <li>Refresh the page and tap <strong>Enable Notifications</strong>.</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-orange-500/20"
              >
                Understood / Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
