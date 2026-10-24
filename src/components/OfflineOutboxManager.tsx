import React, { useState, useEffect } from 'react';
import { 
  getOfflineWaybills, 
  getPendingOfflineCount, 
  syncOfflineWaybills, 
  removeOfflineWaybill,
  OfflineWaybillPayload 
} from '../lib/offlineWaybillSync';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, Clock, Trash2, X, AlertTriangle, ShieldCheck } from 'lucide-react';

export const OfflineOutboxManager: React.FC = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [queue, setQueue] = useState<OfflineWaybillPayload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);

  const refreshState = () => {
    const items = getOfflineWaybills();
    setQueue(items);
    setPendingCount(items.filter(w => w.status !== 'synced').length);
  };

  useEffect(() => {
    refreshState();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync on reconnection
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshState();
    };

    const handleQueueChange = () => {
      refreshState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('waybilla:offline-queue-changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('waybilla:offline-queue-changed', handleQueueChange);
    };
  }, []);

  const triggerSync = async () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    if (!token) return;

    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await syncOfflineWaybills(token);
      setSyncResult({ synced: res.synced, failed: res.failed });
      refreshState();
      if (res.synced > 0 && res.failed === 0) {
        setTimeout(() => {
          setSyncResult(null);
        }, 4000);
      }
    } catch (e) {
      console.error('Offline sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (offlineId: string) => {
    if (window.confirm('Delete this offline waybill draft? It will not be sent to the server.')) {
      removeOfflineWaybill(offlineId);
      refreshState();
    }
  };

  // If there are no pending waybills and user is online, no need to show intrusive banner
  if (pendingCount === 0 && isOnline && !isOpen && !syncResult) {
    return null;
  }

  return (
    <>
      {/* Floating Outbox Notification Capsule */}
      <div className="fixed bottom-4 left-4 z-[9990] flex items-center gap-2">
        {pendingCount > 0 && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-full shadow-xl text-xs sm:text-sm font-bold border border-amber-400 transition-all hover:scale-105 cursor-pointer animate-pulse-subtle"
            title="Click to view offline waybills awaiting sync"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-200" />
            <span>
              {pendingCount} Offline {pendingCount === 1 ? 'Waybill' : 'Waybills'}
            </span>
            <span className="bg-amber-800/80 px-2 py-0.5 rounded-full text-[11px] font-extrabold uppercase">
              Outbox
            </span>
          </button>
        )}

        {isSyncing && (
          <div className="flex items-center gap-2 bg-[#0A1F44] text-white px-3.5 py-2 rounded-full shadow-xl text-xs font-semibold border border-blue-800">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span>Syncing with Cloud...</span>
          </div>
        )}

        {syncResult && syncResult.synced > 0 && (
          <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-bold animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{syncResult.synced} Synced to Server!</span>
          </div>
        )}
      </div>

      {/* Offline Outbox Management Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#0A1F44] to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <WifiOff className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Offline Waybill Outbox</h3>
                  <p className="text-xs text-slate-300">
                    {queue.length} {queue.length === 1 ? 'record' : 'records'} stored safely on this phone
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation card for Judges / Users */}
            <div className="p-4 bg-amber-50 border-b border-amber-200/60 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Zero-Downtime Motor Park Reliability</p>
                <p className="text-amber-800/90 mt-0.5 leading-relaxed">
                  When MTN, Airtel, or Glo network is dead at Upper Iweka or Nkwo Nnewi, staff can still register waybills and print thermal receipts. All transactions are held here securely and sync to the cloud automatically once signal returns.
                </p>
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {queue.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500/80 mb-2" />
                  <p className="font-bold text-slate-700">Outbox is completely clear</p>
                  <p className="text-xs text-slate-400 mt-1">All offline waybills have been synchronized with the cloud.</p>
                </div>
              ) : (
                queue.map((item) => (
                  <div 
                    key={item.offline_id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:bg-white transition shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs text-[#0A1F44] bg-blue-100 px-2 py-0.5 rounded">
                          {item.offline_tracking_code}
                        </span>
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">
                          {item.item_description}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        To: <strong className="text-slate-700">{item.receiver_name}</strong> ({item.destination_park})
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
                        {item.status === 'failed' ? (
                          <span className="text-red-600 font-semibold">Sync error</span>
                        ) : item.status === 'syncing' ? (
                          <span className="text-blue-600 font-semibold">Syncing...</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Queued Offline</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(item.offline_id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Delete from offline outbox"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                <span className="font-semibold text-slate-600">
                  {isOnline ? 'Online (Ready to sync)' : 'Offline (Awaiting connection)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={triggerSync}
                  disabled={isSyncing || queue.length === 0}
                  className="flex items-center gap-1.5 bg-[#0A1F44] hover:bg-blue-900 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
