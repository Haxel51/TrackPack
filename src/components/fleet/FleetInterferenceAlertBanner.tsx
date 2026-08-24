import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bell,
  X,
  Smartphone,
  MapPinOff,
  Radio,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { getFleetAlerts, dismissFleetAlert } from '../../lib/api';
import { sendBrowserNotification, requestNotificationPermission } from '../../lib/pushAlerts';

export interface FleetAlert {
  id: string;
  company_id: string;
  trip_id?: string;
  alert_type: 'app_deleted' | 'permission_disabled' | 'app_killed' | string;
  driver_name: string;
  driver_phone?: string;
  truck_number: string;
  message: string;
  whatsapp_message?: string;
  whatsapp_url?: string;
  driver_whatsapp_url?: string;
  target_roles: string[];
  created_at: string;
  read?: boolean;
}

interface FleetInterferenceAlertBannerProps {
  token: string;
  userRole?: string;
  onAlertClick?: (alert: FleetAlert) => void;
}

export const FleetInterferenceAlertBanner: React.FC<FleetInterferenceAlertBannerProps> = ({
  token,
  userRole = 'company',
  onAlertClick
}) => {
  const [alerts, setAlerts] = useState<FleetAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [seenAlertIds, setSeenAlertIds] = useState<Set<string>>(new Set());

  // Request browser push notification permissions once on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const fetchAlerts = async () => {
    if (!token) return;
    try {
      const res = await getFleetAlerts(token);
      if (res && res.success && Array.isArray(res.alerts)) {
        const unreadAlerts: FleetAlert[] = res.alerts.filter((a: FleetAlert) => !a.read);
        setAlerts(unreadAlerts);

        // Fire browser notification for newly detected alerts
        unreadAlerts.forEach((alert) => {
          if (!seenAlertIds.has(alert.id)) {
            sendBrowserNotification('Waybilla Security Alert ⚠️', {
              body: alert.message,
              tag: alert.id,
              requireInteraction: true
            });
          }
        });

        setSeenAlertIds(new Set(unreadAlerts.map(a => a.id)));
      }
    } catch (e) {
      console.warn('Error fetching fleet alerts:', e);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000); // Polling every 10 seconds for real-time interference
    return () => clearInterval(interval);
  }, [token]);

  const handleDismiss = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await dismissFleetAlert(token, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2.5 mb-5 animate-bounce-short">
      {alerts.map((alert) => {
        let icon = <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />;
        let badgeText = 'Interference Alert';
        let bgStyle = 'bg-gradient-to-r from-rose-950/90 via-slate-900 to-rose-950/80 border-rose-600/60 shadow-rose-950/50';

        if (alert.alert_type === 'app_deleted') {
          icon = <Smartphone className="w-5 h-5 text-rose-400 shrink-0" />;
          badgeText = 'App Removed / Inactive';
        } else if (alert.alert_type === 'permission_disabled') {
          icon = <MapPinOff className="w-5 h-5 text-amber-400 shrink-0" />;
          badgeText = 'Location Disabled';
          bgStyle = 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/80 border-amber-600/60 shadow-amber-950/50';
        } else if (alert.alert_type === 'app_killed') {
          icon = <Radio className="w-5 h-5 text-orange-400 shrink-0 animate-pulse" />;
          badgeText = 'App Terminated in Background';
          bgStyle = 'bg-gradient-to-r from-orange-950/90 via-slate-900 to-orange-950/80 border-orange-600/60 shadow-orange-950/50';
        }

        return (
          <div
            key={alert.id}
            id={`alert-banner-${alert.id}`}
            onClick={() => onAlertClick && onAlertClick(alert)}
            className={`border rounded-2xl p-4 shadow-xl flex items-start justify-between gap-3 relative overflow-hidden transition-all duration-200 hover:scale-[1.005] cursor-pointer ${bgStyle}`}
          >
            {/* Pulsing indicator pill */}
            <div className="flex items-start gap-3.5 flex-1">
              <div className="p-2.5 bg-black/40 rounded-xl border border-white/10 shrink-0 mt-0.5">
                {icon}
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                    {badgeText}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                  {alert.message}
                </p>

                <p className="text-[11px] text-slate-300 font-medium">
                  Truck: <strong className="text-amber-300">{alert.truck_number}</strong> &bull; Driver: <strong className="text-white">{alert.driver_name}</strong>
                  {alert.driver_phone && <span className="ml-1 text-slate-400">({alert.driver_phone})</span>}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
              {/* WhatsApp 1-Click Dispatch Button */}
              {alert.whatsapp_url && (
                <a
                  href={alert.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Forward Alert on WhatsApp"
                  className="bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 text-[#25D366] hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.993L2 22l5.233-1.237a9.96 9.96 0 004.779 1.221h.005c5.505 0 9.988-4.478 9.989-9.985A9.982 9.982 0 0012.012 2zm.005 18.281a8.27 8.27 0 01-4.223-1.157l-.303-.18-3.138.742.833-3.057-.197-.314a8.27 8.27 0 01-1.272-4.331c0-4.562 3.712-8.274 8.276-8.274 2.21 0 4.288.861 5.852 2.427a8.22 8.22 0 012.422 5.857c0 4.563-3.712 8.276-8.275 8.276zm4.536-6.196c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.8 6.8 0 01-1.998-1.232 7.502 7.502 0 01-1.383-1.724c-.145-.249-.015-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.767-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.406 1.016 2.573.125.166 1.756 2.682 4.255 3.761.594.257 1.058.41 1.42.525.597.19 1.14.163 1.57.099.48-.072 1.472-.602 1.679-1.183.207-.581.207-1.079.145-1.183-.062-.104-.228-.187-.477-.312z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={(e) => handleDismiss(alert.id, e)}
                title="Acknowledge & Dismiss Alert"
                className="bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Acknowledge</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
