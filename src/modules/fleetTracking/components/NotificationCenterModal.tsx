import React, { useState } from 'react';
import { Bell, X, Check, Clock, CheckCheck, Truck, Navigation, AlertTriangle, ShieldAlert, CreditCard } from 'lucide-react';
import { markNotificationAsRead as apiMarkRead, markAllNotificationsAsRead as apiMarkAllRead } from '../api';

export interface FleetNotification {
  id: string;
  companyId?: string;
  company_id?: string;
  tripId?: string;
  truckId?: string;
  trip_id?: string;
  truck_id?: string;
  type?: string;
  title: string;
  message?: string;
  body?: string;
  created_at?: string;
  timestamp?: string;
  read?: boolean;
  targetRoles?: string[];
  plate_number?: string;
  data?: any;
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  notifications: FleetNotification[];
  onRefresh: () => void;
  onMarkAllRead?: () => void;
  onMarkSingleRead?: (id: string) => void;
  onSelectTrip?: (tripId: string) => void;
  onSelectTruck?: (truckId: string) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  token,
  notifications,
  onRefresh,
  onMarkAllRead,
  onMarkSingleRead,
  onSelectTrip,
  onSelectTruck
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const displayNotifs = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const markAsRead = async (id: string) => {
    try {
      if (onMarkSingleRead) {
        onMarkSingleRead(id);
      }
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('company_token') || localStorage.getItem('manager_token') : null);
      await apiMarkRead(id, activeToken || undefined);
      onRefresh();
    } catch {
      // Graceful fallback
    }
  };

  const markAllAsRead = async () => {
    try {
      if (onMarkAllRead) {
        onMarkAllRead();
      }
      const allIds = notifications.map(n => n.id).filter(Boolean);
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('company_token') || localStorage.getItem('manager_token') : null);
      await apiMarkAllRead(activeToken || undefined, allIds);
      onRefresh();
    } catch {
      // Graceful fallback
    }
  };

  const handleNotificationClick = async (notif: FleetNotification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    const targetTrip = notif.tripId || notif.trip_id;
    const targetTruck = notif.truckId || notif.truck_id;

    if (targetTrip && onSelectTrip) {
      onSelectTrip(targetTrip);
      onClose();
    } else if (targetTruck && onSelectTruck) {
      onSelectTruck(targetTruck);
      onClose();
    }
  };

  const getNotifIcon = (type?: string) => {
    if (!type) return <Bell className="w-4 h-4 text-orange-600" />;
    if (type.includes('stopped') || type.includes('warning') || type.includes('alert')) {
      return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    }
    if (type.includes('subscription') || type.includes('payment')) {
      return <CreditCard className="w-4 h-4 text-emerald-600" />;
    }
    if (type.includes('departed') || type.includes('arrived') || type.includes('loaded')) {
      return <Navigation className="w-4 h-4 text-blue-600" />;
    }
    return <Truck className="w-4 h-4 text-orange-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-md bg-white border-l border-slate-200 text-slate-900 h-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-900">Fleet Activity Alerts</h2>
              <p className="text-[11px] text-slate-500 font-medium">Real-time push & telemetry alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-slate-500 hover:text-orange-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Read All</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-3 bg-slate-50/70 border-b border-slate-200 text-xs font-extrabold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'unread'
                ? 'bg-orange-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            Unread ({notifications.filter(n => !n.read).length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          {displayNotifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Bell className="w-10 h-10 mb-3 opacity-30 text-slate-300" />
              <p className="font-bold text-sm text-slate-700">No Notifications</p>
              <p className="text-xs text-slate-500 mt-1">You're all caught up! Fleet notifications will appear here in real time.</p>
            </div>
          ) : (
            displayNotifs.map(notif => {
              const rawMsg = notif.message || notif.body || '';
              const realPlate = notif.plate_number || notif.data?.plate_number;
              const textMsg = rawMsg.replace(
                /\s*\((?:Truck Plate|Truck)\)/gi,
                realPlate && !realPlate.toLowerCase().includes('truck') ? ` (${realPlate})` : ''
              );
              const timeStr = notif.created_at || notif.timestamp ? new Date(notif.created_at || notif.timestamp!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
              
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                    notif.read
                      ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      : 'bg-orange-50/70 border-orange-300 hover:border-orange-400 text-slate-900 shadow-xs'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0 mt-0.5">
                      {getNotifIcon(notif.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate flex items-center gap-1.5">
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 animate-pulse" />
                          )}
                          <span>{notif.title}</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {timeStr}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {textMsg}
                      </p>

                      {(notif.tripId || notif.trip_id || notif.truckId || notif.truck_id) && (
                        <div className="mt-2 flex items-center text-[10px] font-extrabold text-orange-600 group-hover:underline">
                          Tap to view details &rarr;
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-[11px] text-slate-500 font-medium">
            Automated alerts dispatched via Push & GPS Telemetry Engine
          </p>
        </div>

      </div>
    </div>
  );
};
