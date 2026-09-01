import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { LanguageSwitcher } from '../../../components/LanguageSwitcher';
import { Logo } from '../../../components/Logo';
import { FleetLocationsView } from './FleetLocationsView';
import { TrucksManagement } from '../components/TrucksManagement';
import { TripsManagement } from '../components/TripsManagement';
import { TeamManagement } from '../components/TeamManagement';
import { PaymentHistoryView } from '../components/PaymentHistoryView';
import { FleetAnalyticsManagement } from '../components/FleetAnalyticsManagement';
import { NotificationCenterModal, FleetNotification } from '../components/NotificationCenterModal';
import { FleetNotificationPromptOverlay } from '../components/FleetNotificationPromptOverlay';
import { FleetPushNotificationCard } from '../components/FleetPushNotificationCard';
import { initializeFCM, requestNotificationPermission, isIframeContext } from '../fcm';
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

  const canSwitchModule = Boolean(onSwitchModule && showSwitchModule && !isManager && !isTripMonitor && role === 'company');

  const [activeTab, setActiveTab] = useState<'trucks' | 'locations' | 'trips' | 'team' | 'overview' | 'payments' | 'analytics'>(
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
    if (!token) return;
    try {
      const res = await fetch('/api/fleet-tracking/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch (e) {
      console.error('Error fetching fleet notifications:', e);
    }
  }, [token]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission(token || undefined, user?.id || user?.owner_phone);
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
    if (token) {
      initializeFCM(token, user?.id || user?.owner_phone);
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000);
      return () => clearInterval(interval);
    }
  }, [token, fetchNotifications, user?.id, user?.owner_phone]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
                {t('fleetModuleBadge')}
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
                  className="hidden md:flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
                  id="desktop-switch-module-btn-fleet"
                >
                  <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                  <span>{t('switchModule')}</span>
                </button>
                <div className="h-6 w-[1px] bg-slate-800 hidden md:block" />
              </>
            )}

            <LanguageSwitcher />

            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Fleet Notifications"
              id="fleet-notification-bell-btn"
            >
              <Bell className="w-4 h-4 text-amber-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center animate-bounce shadow-md border border-slate-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              id="fleet-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('signOut')}</span>
            </button>
          </div>

        </div>

        {/* Tab Sub-Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex border-t border-slate-800/80 gap-2 pt-2 overflow-x-auto scrollbar-none pb-1">
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
            <span>{t('fleetOverviewTab')}</span>
          </button>

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
              <span>{t('fleetTrucksTab')}</span>
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
              <span>{t('fleetLocationsTab')}</span>
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
            <span>{t('fleetTripsTab')}</span>
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
              <span>{t('fleetTeamTab')}</span>
            </button>
          )}

          {isCEO && (
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'payments'
                  ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
              id="fleet-tab-payments"
            >
              <CreditCard className={`w-4 h-4 ${activeTab === 'payments' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>{t('fleetPaymentTab')}</span>
            </button>
          )}

          {(isCEO || isManager) && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2.5 text-xs font-extrabold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 border-b-2 whitespace-nowrap shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-slate-900 text-amber-400 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border-transparent'
              }`}
              id="fleet-tab-analytics"
            >
              <BarChart3 className={`w-4 h-4 ${activeTab === 'analytics' ? 'text-amber-400' : 'text-slate-500'}`} />
              <span>Analytics & Reports</span>
            </button>
          )}
        </div>
      </header>

      {/* Notification Permission Request Flow (Overlay + Banner) */}
      <FleetNotificationPromptOverlay />

      {/* Foreground Toast Notification Banner */}
      {foregroundToast && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-950/95 border border-amber-500/50 shadow-2xl rounded-2xl p-4 text-white backdrop-blur-md animate-fade-in flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-xs text-amber-300">{foregroundToast.title}</h4>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{foregroundToast.body}</p>
          </div>
          <button
            onClick={() => setForegroundToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-all cursor-pointer shrink-0"
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

        {/* TAB 5: PAYMENT HISTORY */}
        {activeTab === 'payments' && (
          <PaymentHistoryView token={token || ''} isCEO={isCEO} />
        )}

        {/* TAB 6: ANALYTICS & REPORTS */}
        {activeTab === 'analytics' && (isCEO || isManager) && (
          <FleetAnalyticsManagement token={token || ''} role={role} user={user} />
        )}

        {/* TAB 3: FLEET OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in" id="fleet-overview-view">
            <FleetPushNotificationCard />

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

      <NotificationCenterModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        token={token}
        notifications={notifications}
        onRefresh={fetchNotifications}
        onSelectTrip={() => {
          setActiveTab('trips');
        }}
        onSelectTruck={() => {
          setActiveTab('trucks');
        }}
      />

      {/* Notification Settings Instruction Modal for Denied Permission */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BellOff className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm">How to Enable Fleet Alerts</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                Your browser or phone currently blocks notifications for this app. To receive real-time fleet trip & payment updates on your phone:
              </p>
              <ol className="list-decimal list-inside space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-slate-200 font-medium">
                <li>Click the <strong>🔒 Lock icon</strong> or <strong>Site Settings icon</strong> next to the URL address bar.</li>
                <li>Find <strong>Notifications</strong> in the permissions list.</li>
                <li>Switch the setting to <strong>Allow</strong>.</li>
                <li>Refresh the page and tap <strong>Enable Notifications</strong>.</li>
              </ol>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
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
