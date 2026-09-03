import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
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
  Loader2,
  Info
} from 'lucide-react';
import { ShipmentTimeline } from '../components/ShipmentTimeline';
import { NotificationModal } from '../components/NotificationModal';
import { triggerOSNotification } from '../utils/notifications';
import { getCustomerWaybills, confirmCustomerWaybillReceived } from '../lib/api';

export const CustomerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
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

  // Ref to track previous status of waybills for instant push triggers
  const prevWaybillStatuses = useRef<Record<string, string>>({});

  const fetchWaybills = async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setIsLoading(true);
    if (!isSilent) setError(null);
    try {
      const data = await getCustomerWaybills(token);
      if (!data.success && data.error) {
        if (!isSilent) {
          setError(data.error || 'Failed to fetch shipments. Please check your connection.');
        }
      } else {
        const fetchedWaybills: any[] = data.waybills || [];
        
        // Compare with previous statuses to detect real-time updates
        fetchedWaybills.forEach((wb) => {
          const oldStatus = prevWaybillStatuses.current[wb.id];
          if (oldStatus && oldStatus !== wb.status) {
            // Status changed! Trigger OS browser notification via ServiceWorker
            let notifBody = `Waybill ${wb.tracking_code} status is now ${wb.status}.`;
            if (wb.status === 'departed' || wb.status === 'in_transit') {
              notifBody = `Your waybill ${wb.tracking_code} just departed ${wb.origin_park}!`;
            } else if (wb.status === 'arrived') {
              notifBody = `Good news! Your waybill ${wb.tracking_code} arrived at ${wb.destination_park}.`;
            } else if (wb.status === 'collected') {
              notifBody = `Waybill ${wb.tracking_code} delivered and collected safely.`;
            }
            triggerOSNotification('Waybilla Shipment Update 🚚', {
              body: notifBody,
              tag: wb.tracking_code
            });
          }
          // Update ref tracking
          prevWaybillStatuses.current[wb.id] = wb.status;
        });

        setWaybills(fetchedWaybills);
        setError(null);
      }
    } catch (err: any) {
      if (!isSilent) {
        console.warn('Could not fetch waybills:', err?.message || err);
        setError('Network connection error. Please tap Retry to reload your shipments.');
      }
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWaybills();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
      }
    }

    // Connect to real-time instant SSE stream for instant updates
    let eventSource: EventSource | null = null;
    const userPhone = user?.phone_number || '';
    try {
      eventSource = new EventSource(`/api/notifications/stream?phone=${encodeURIComponent(userPhone)}`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'WAYBILL_UPDATE') {
            console.log('[SSE Push Received]:', data);
            triggerOSNotification(data.title || 'Waybilla Shipment Alert 🚚', {
              body: data.body || 'Your waybill status was updated.',
              tag: data.tracking_code || 'waybilla'
            });
            fetchWaybills(true);
          }
        } catch (e) {
          // ignore non-json messages
        }
      };
    } catch {
      // Ignore background SSE connection errors
    }

    // Set up real-time background polling as robust fallback every 10 seconds
    const interval = setInterval(() => {
      fetchWaybills(true);
    }, 10000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [token, user]);

  const handleEnableNotifications = async () => {
    setIsRequestingNotif(true);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Trigger test notification to prove OS notifications are active on device status bar
          await triggerOSNotification('Waybilla Push Alerts Active 🔔', {
            body: 'Push notifications are enabled! You will get instant alerts on your phone notification bar when your waybill status updates.',
            tag: 'waybilla-welcome'
          });

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
        const data = await response.json().catch(() => ({}));
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
      const data = await confirmCustomerWaybillReceived(token, selectedWaybill.id);
      if (!data.success && data.error) {
        alert(data.error || 'Failed to confirm receipt.');
      } else if (data.waybill) {
        // Update both selectedWaybill and waybills list state!
        setSelectedWaybill(data.waybill);
        setWaybills(prev => prev.map(w => w.id === data.waybill.id ? data.waybill : w));
      }
    } catch (err) {
      console.warn('Error confirming receipt:', err);
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
      <header className="bg-[#0A1F44] text-white px-3 sm:px-6 py-3 sm:py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Logo size="sm" showText={false} />
            <div className="flex items-center gap-1.5 sm:gap-2 font-extrabold text-base sm:text-lg tracking-wider min-w-0">
              <span className="truncate">Waybilla</span>
              <span className="hidden xs:inline-flex items-center shadow-xs rounded overflow-hidden border border-white/20 shrink-0" title="Nigeria">
                <svg className="w-4 sm:w-5 h-3 sm:h-3.5" viewBox="0 0 3 2">
                  <rect width="1" height="2" x="0" fill="#008751" />
                  <rect width="1" height="2" x="1" fill="#FFFFFF" />
                  <rect width="1" height="2" x="2" fill="#008751" />
                </svg>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 sm:gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">{t('signOut')}</span>
            </button>
          </div>
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{t('customerDashboardTitle')}</p>
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
              onClick={() => fetchWaybills()}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0A1F44] bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('clearResult') === 'Clear' ? 'Refresh' : t('clearResult')}
            </button>
          </div>
        </div>

        {/* Customer Quick Guide Banner */}
        <div className="bg-blue-50/80 border border-blue-200/90 rounded-3xl p-5 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-black text-[#0A1F44] text-sm">
            <span>💡 {t('howWorksSubtitle')}</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {t('customerDesc')}: (<strong>{user?.phone_number}</strong>)
          </p>
          <div className="bg-white p-3 rounded-2xl border border-blue-100 text-xs text-slate-700 space-y-1">
            <p className="font-extrabold text-[#0A1F44] flex items-center gap-1">
              📍 <strong>{t('pickupPinInstruction')}:</strong>
            </p>
            <p className="text-[11px] leading-relaxed text-slate-600">
              {t('custStep2')}
            </p>
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
                <h3 className="font-black text-base sm:text-lg">Get notified the moment your waybill moves 📦</h3>
                <p className="text-xs font-semibold opacity-90 mt-0.5">Receive instant alerts on your device when your shipments depart, arrive, or are delivered.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end shrink-0">
              <button
                onClick={handleEnableNotifications}
                disabled={isRequestingNotif}
                className="bg-[#0A1F44] hover:bg-[#091026] text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition-all shadow-md cursor-pointer whitespace-nowrap flex items-center gap-2"
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
                <p className="text-[11px] text-emerald-700">You will receive instant push notifications when your waybills move.</p>
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
            <div className="bg-white border border-slate-100 rounded-3xl p-10 text-center shadow-sm space-y-4">
              <div className="w-14 h-14 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                <Package className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-600 max-w-xs mx-auto">
                No active shipments found for {user?.phone_number || 'your account'}.
              </p>
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-left flex items-start gap-3 max-w-md mx-auto">
                <div className="p-1.5 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div className="text-xs text-amber-950 leading-relaxed font-medium">
                  <strong className="font-extrabold text-amber-900 block mb-0.5">Looking for a waybill?</strong>
                  Make sure the park staff registered your waybill using this exact phone number (<strong>{user?.phone_number}</strong>) as either the <strong>Sender</strong> or the <strong>Receiver</strong>.
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5" id="customer-shipment-list">
              {waybills.map((w, index) => {
                const isUserSender = user?.phone_number === w.sender_phone;
                return (
                  <div
                    key={`cust-wb-${w.id || index}-${index}`}
                    onClick={() => handleSelectWaybill(w)}
                    id={index === 0 ? "customer-shipment-card" : undefined}
                    className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all cursor-pointer flex items-center justify-between group"
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
                        {w.pickup_pin && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                            🔑 Pickup PIN: {w.pickup_pin}
                          </span>
                        )}
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
                          {(w.status || '').replace('_', ' ')}
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
        <div className="fixed inset-0 bg-[#091026]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
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
              />
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 bg-white border-t border-slate-100 mt-12 space-y-1">
        <div>Waybilla is a product of <span className="text-slate-800 font-bold">Haxel Tech-Solutions</span></div>
        <div className="text-[11px] text-slate-400">&copy; {new Date().getFullYear()} Haxel Tech-Solutions. All rights reserved.</div>
      </footer>
    </div>
  );
};
