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
    } catch (e) {
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
    } catch (e) {
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
    if (!type) return <Bell className="w-4 h-4 text-amber-400" />;
    if (type.includes('stopped') || type.includes('warning') || type.includes('alert')) {
      return <AlertTriangle className="w-4 h-4 text-rose-400" />;
    }
    if (type.includes('subscription') || type.includes('payment')) {
      return <CreditCard className="w-4 h-4 text-emerald-400" />;
    }
    if (type.includes('departed') || type.includes('arrived') || type.includes('loaded')) {
      return <Navigation className="w-4 h-4 text-blue-400" />;
    }
    return <Truck className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070b19]/80 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-md bg-[#0b1329] border-l border-blue-950/60 text-slate-100 h-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-4 bg-[#070b19] border-b border-blue-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm text-slate-100">Fleet Activity Alerts</h2>
              <p className="text-[11px] text-slate-400 font-medium">Real-time push & system notifications</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={markAllAsRead}
              className="text-[11px] font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-[#131e3d] cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Read All</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#131e3d] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-3 bg-[#070b19]/50 border-b border-blue-950/60/80 text-xs font-extrabold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131e3d]'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              filter === 'unread'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#131e3d]'
            }`}
          >
            Unread ({notifications.filter(n => !n.read).length})
          </button>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-700">
          {displayNotifs.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Bell className="w-10 h-10 mb-3 opacity-30 text-slate-400" />
              <p className="font-bold text-sm text-slate-400">No Notifications</p>
              <p className="text-xs text-slate-500 mt-1">You're all caught up! Fleet notifications will appear here in real time.</p>
            </div>
          ) : (
            displayNotifs.map(notif => {
              const textMsg = notif.message || notif.body || '';
              const timeStr = notif.created_at || notif.timestamp ? new Date(notif.created_at || notif.timestamp!).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '';
              
              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                    notif.read
                      ? 'bg-[#0b1329]/60 border-blue-950/60/80 hover:border-blue-900/65 text-slate-300'
                      : 'bg-[#131e3d]/80 border-amber-500/40 hover:border-amber-500 text-slate-100 shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-[#070b19] border border-blue-950/60 shrink-0 mt-0.5">
                      {getNotifIcon(notif.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-bold text-xs text-slate-100 truncate flex items-center gap-1.5">
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
                          )}
                          <span>{notif.title}</span>
                        </h4>
                        <span className="text-[10px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {timeStr}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-normal">
                        {textMsg}
                      </p>

                      {(notif.tripId || notif.trip_id || notif.truckId || notif.truck_id) && (
                        <div className="mt-2 flex items-center text-[10px] font-extrabold text-amber-400 group-hover:underline">
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
        <div className="p-3 bg-[#070b19] border-t border-blue-950/60 text-center">
          <p className="text-[11px] text-slate-500">
            Automated alerts dispatched via FCM & In-App Fleet Dispatcher
          </p>
        </div>

      </div>
    </div>
  );
};
