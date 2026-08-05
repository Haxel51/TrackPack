import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, 
  User as UserIcon, 
  Shield, 
  Package, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  RefreshCw, 
  X,
  Clock,
  ArrowRight,
  Bell,
  BellOff,
  Loader2
} from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import { NotificationModal } from '../components/NotificationModal';

export const CustomerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [waybills, setWaybills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaybill, setSelectedWaybill] = useState<any>(null);
  const [selectedRoute, setSelectedRoute] = useState<any>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Push Notifications State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );
  const [isRequestingNotif, setIsRequestingNotif] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);

  const fetchWaybills = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/customer/waybills', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Failed to fetch shipments.');
      } else {
        setWaybills(data.waybills);
      }
    } catch (err) {
      console.error('Error fetching waybills:', err);
      setError('Network connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWaybills();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }
  }, [token]);

  const handleEnableNotifications = async () => {
    setIsRequestingNotif(true);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const deviceToken = `fcm_web_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          await fetch('/api/customer/fcm-token', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token: deviceToken })
          });
          setNotificationsEnabled(true);
          setNotificationDismissed(false);
        } else {
          setNotificationDismissed(true);
        }
      } catch (e) {
        console.error('Error enabling notifications:', e);
      } finally {
        setIsRequestingNotif(false);
      }
    }
    setShowNotifModal(false);
  };

  const handleToggleNotifications = async () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    try {
      await fetch('/api/customer/toggle-notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: nextVal })
      });
    } catch (e) {
      console.error('Error toggling notifications:', e);
    }
  };

  const handleSelectWaybill = async (waybill: any) => {
    setSelectedWaybill(waybill);
    setSelectedRoute(null);
    setSelectedDriver(null);
    // Fetch route for additional details (estimated hours etc)
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(waybill.tracking_code)}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedRoute(data.route);
        setSelectedDriver(data.driver);
      }
    } catch (e) {
      console.error('Failed to pre-fetch route for detail modal:', e);
    }
  };

  const handleConfirmReceived = async () => {
    if (!selectedWaybill || !token) return;
    setIsConfirming(true);
    try {
      const response = await fetch(`/api/customer/waybills/${selectedWaybill.id}/confirm-received`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || 'Failed to confirm receipt.');
      } else {
        // Update both selectedWaybill and waybills list state!
        setSelectedWaybill(data.waybill);
        setWaybills(prev => prev.map(w => w.id === data.waybill.id ? data.waybill : w));
      }
    } catch (err) {
      console.error('Error confirming receipt:', err);
      alert('Network error. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('en-NG', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const getStatusColorClass = (status: string) => {
    if (status === 'booked') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (status === 'departed' || status === 'in_transit') return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const isReceiver = selectedWaybill && user?.phone_number === selectedWaybill.receiver_phone;
  const showConfirmButton = selectedWaybill && isReceiver && selectedWaybill.status === 'arrived';

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-between">
      {/* Navbar */}
      <header className="bg-[#0A1F44] text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Package className="text-[#F2A93B] w-6 h-6" />
            <div className="flex items-center gap-2 font-extrabold text-lg tracking-wider">
              <span>TrackPack</span>
              <span className="inline-flex items-center shadow-xs rounded overflow-hidden border border-white/20" title="Nigeria">
                <svg className="w-5 h-3.5" viewBox="0 0 3 2">
                  <rect width="1" height="2" x="0" fill="#008751" />
                  <rect width="1" height="2" x="1" fill="#FFFFFF" />
                  <rect width="1" height="2" x="2" fill="#008751" />
                </svg>
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl w-full mx-auto flex-grow p-6 space-y-6">
        {/* Welcome Header with Profile Controls */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0A1F44]/5 text-[#0A1F44] rounded-2xl flex items-center justify-center">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">CUSTOMER PORTAL</p>
              <h2 className="text-xl font-extrabold text-[#0A1F44] mt-1">{user?.phone_number}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Push Notifications Toggle */}
            <button
              onClick={handleToggleNotifications}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                notificationsEnabled 
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle Push Notifications"
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                  <span>Push Alerts: ON</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Push Alerts: OFF</span>
                </>
              )}
            </button>

            <button
              onClick={fetchWaybills}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0A1F44] bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Optional Notification Explanation Modal */}
        {showNotifModal && (
          <NotificationModal 
            onEnable={handleEnableNotifications}
            onDismiss={() => {
              setShowNotifModal(false);
              setNotificationDismissed(true);
            }}
          />
        )}

        {/* Push Notification Banner / Prompt */}
        {!notificationsEnabled && !notificationDismissed && (
          <div className="bg-gradient-to-r from-amber-500 to-[#F2A93B] text-[#0A1F44] rounded-3xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4" id="notification-prompt-banner">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6 text-[#0A1F44]" />
              </div>
              <div>
                <h3 className="font-black text-base sm:text-lg">Get notified the moment your package moves 📦</h3>
                <p className="text-xs font-semibold opacity-90 mt-0.5">Receive instant alerts on your device when your shipments depart, arrive, or are delivered.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
              <button
                onClick={handleEnableNotifications}
                disabled={isRequestingNotif}
                className="bg-[#0A1F44] hover:bg-slate-900 text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer whitespace-nowrap flex items-center gap-2"
              >
                {isRequestingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 text-[#F2A93B]" />}
                Enable Notifications
              </button>
              <button
                onClick={() => setNotificationDismissed(true)}
                className="text-xs font-bold text-[#0A1F44] hover:underline px-3 py-2 cursor-pointer bg-transparent border-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {(!notificationsEnabled && notificationDismissed) && (
          <div className="text-center py-1">
            <button
              onClick={() => { setNotificationDismissed(false); handleEnableNotifications(); }}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer bg-transparent border-0 inline-flex items-center gap-1.5 py-1 px-3 bg-amber-50 rounded-xl border border-amber-200"
            >
              <BellOff className="w-3.5 h-3.5 text-amber-600" />
              Notifications off — tap to enable
            </button>
          </div>
        )}

        {notificationsEnabled && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4" id="notifications-active-banner">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-black">
                ✓
              </div>
              <div>
                <p className="text-xs font-extrabold text-emerald-900">Notifications enabled</p>
                <p className="text-[11px] text-emerald-700">You will receive instant push notifications when your packages move.</p>
              </div>
            </div>
            <button
              onClick={handleToggleNotifications}
              className="text-xs font-extrabold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-xs cursor-pointer"
            >
              Turn Off
            </button>
          </div>
        )}

        {/* Shipments Section */}
        <div className="space-y-4">
          <h1 className="text-lg font-extrabold text-[#0A1F44] tracking-tight">
            Your Shipments
          </h1>

          {isLoading ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
              <div className="inline-block w-8 h-8 border-4 border-[#0A1F44] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-500">Retrieving your digital waybills...</p>
            </div>
          ) : error ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-8 text-center shadow-sm space-y-4">
              <p className="text-sm font-bold text-red-500">{error}</p>
              <button 
                onClick={fetchWaybills}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : waybills.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-500 max-w-xs mx-auto">
                No shipments yet. Your tracking history will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {waybills.map((w, index) => {
                const isUserSender = user?.phone_number === w.sender_phone;
                return (
                  <div
                    key={`cust-wb-${w.id || index}-${index}`}
                    onClick={() => handleSelectWaybill(w)}
                    className="bg-white border border-slate-100 hover:border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-3 flex-grow min-w-0 pr-4">
                      {/* Top Line: Tracking code and Role tag */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-sm text-[#0A1F44] uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded">
                          {w.tracking_code}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest border
                          ${isUserSender 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'}
                        `}>
                          {isUserSender ? 'SENDER' : 'RECEIVER'}
                        </span>
                      </div>

                      {/* Middle Line: Description */}
                      <h3 className="font-bold text-slate-800 text-base leading-snug truncate">
                        {w.item_description}
                      </h3>

                      {/* Bottom Line: Route, Status, Date */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1 text-slate-600 font-bold">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {w.origin_park}
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          {w.destination_park}
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-300" />
                          {formatDate(w.created_at || w.booked_at)}
                        </span>

                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${getStatusColorClass(w.status)}`}>
                          {w.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#F2A93B] group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Shipment Details Backdrop / Modal Dialog */}
      {selectedWaybill && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto relative animate-scaleUp">
            
            {/* Modal Close Button */}
            <button
              onClick={() => {
                setSelectedWaybill(null);
                setSelectedRoute(null);
                setSelectedDriver(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all z-10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-1 sm:p-2">
              <ShipmentTimeline 
                waybill={selectedWaybill} 
                route={selectedRoute} 
                driver={selectedDriver}
                showConfirmButton={showConfirmButton} 
                onConfirmReceived={handleConfirmReceived}
                isConfirming={isConfirming}
              />
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-400 bg-white border-t border-slate-100 mt-12">
        &copy; {new Date().getFullYear()} TrackPack. All rights reserved.
      </footer>
    </div>
  );
};
