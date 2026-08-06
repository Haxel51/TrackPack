import React, { useState } from 'react';
import { Bell, ShieldCheck, X } from 'lucide-react';

interface NotificationModalProps {
  onEnable: () => Promise<void>;
  onDismiss: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  onEnable,
  onDismiss
}) => {
  const [loading, setLoading] = useState(false);

  const handleEnableClick = async () => {
    setLoading(true);
    try {
      await onEnable();
    } catch (e) {
      console.error("Error enabling notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6 relative border border-slate-100">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-3 pt-2">
          <div className="w-16 h-16 bg-amber-50 text-[#F2A93B] rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-amber-100">
            <Bell className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-extrabold text-[#0A1F44]">
            Get Notified instantly
          </h3>

          <p className="text-sm font-semibold text-slate-600 leading-relaxed max-w-xs mx-auto">
            Get notified the moment your waybill moves — from dispatch to delivery at your destination motor park.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-2 text-slate-700 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Real-time SMS & Push Alerts</span>
          </div>
          <p>
            You will only receive updates regarding your active waybills and shipments.
          </p>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={handleEnableClick}
            disabled={loading}
            className="w-full bg-[#0A1F44] hover:bg-blue-950 disabled:bg-slate-400 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bell className="w-4 h-4 text-[#F2A93B]" />
            )}
            Enable Notifications
          </button>

          <button
            onClick={onDismiss}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};
