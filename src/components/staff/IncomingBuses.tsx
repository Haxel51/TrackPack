import React, { useState, useEffect } from 'react';
import { getIncomingBuses, arriveBus, collectWaybill } from '../../lib/api';
import { Bus } from '../../types';
import { Truck, ArrowLeft, Loader2, Phone, User, FileText, CheckCircle, Navigation, PackageCheck, Check, Shield, X } from 'lucide-react';

interface IncomingBusesProps {
  token: string;
  onBackToMenu: () => void;
}

export const IncomingBuses: React.FC<IncomingBusesProps> = ({ token, onBackToMenu }) => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks busId being marked arrived
  const [collectLoading, setCollectLoading] = useState<string | null>(null); // tracks waybillId being marked collected
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [verifyingWaybill, setVerifyingWaybill] = useState<{ id: string; tracking_code: string; receiver_name: string } | null>(null);
  const [inputPhone, setInputPhone] = useState('');

  const fetchBuses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIncomingBuses(token);
      if (res.success && res.buses) {
        setBuses(res.buses);
      } else {
        setError(res.error || 'Failed to load incoming buses.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching incoming buses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  const handleArriveBus = async (busId: string, busNumber: string) => {
    setActionLoading(busId);
    setConfirmationMessage(null);
    setError(null);

    try {
      const res = await arriveBus(token, busId);
      if (res.success) {
        setConfirmationMessage(`Bus ${busNumber} marked as arrived successfully. ${res.count} waybills updated to arrived status.`);
        // Reload list
        const reloadRes = await getIncomingBuses(token);
        if (reloadRes.success && reloadRes.buses) {
          setBuses(reloadRes.buses);
        }
      } else {
        setError(res.error || `Failed to mark bus ${busNumber} as arrived.`);
      }
    } catch (err) {
      console.error(err);
      setError(`An error occurred while updating bus ${busNumber}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingWaybill) return;
    if (!inputPhone.trim()) {
      setError("Please enter the receiver's phone number for verification.");
      return;
    }

    const waybillId = verifyingWaybill.id;
    const trackingCode = verifyingWaybill.tracking_code;

    setCollectLoading(waybillId);
    setConfirmationMessage(null);
    setError(null);

    try {
      const res = await collectWaybill(token, waybillId, inputPhone.trim());
      if (res.success) {
        setConfirmationMessage(`Waybill ${trackingCode} successfully verified and marked as collected.`);
        setVerifyingWaybill(null);
        setInputPhone('');
        // Reload list
        const reloadRes = await getIncomingBuses(token);
        if (reloadRes.success && reloadRes.buses) {
          setBuses(reloadRes.buses);
        }
      } else {
        setError(res.error || `Verification failed for waybill ${trackingCode}.`);
      }
    } catch (err) {
      console.error(err);
      setError(`An error occurred while verifying waybill ${trackingCode}.`);
    } finally {
      setCollectLoading(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button 
          onClick={onBackToMenu}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-[#0A1F44] flex items-center gap-2">
            <Truck className="text-[#F2A93B] w-5 h-5" />
            Incoming Bus Manifests
          </h2>
          <p className="text-xs text-slate-500">Track inbound dispatches, mark arrivals, and manage handovers</p>
        </div>
      </div>

      {confirmationMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-5 py-4 rounded-2xl flex items-start gap-3 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold">Operation Successful</h4>
            <p className="text-xs text-emerald-700 mt-1">{confirmationMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading incoming manifest queues...</span>
        </div>
      ) : buses.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
            <Truck className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-[#0A1F44]">No Incoming Buses</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            There are currently no active buses in 'departed' or 'arrived' status headed to this station.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {buses.map((bus, busIdx) => (
            <div key={`inc-bus-${bus.id || busIdx}-${busIdx}`} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-5 mb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-[#0A1F44]">{bus.bus_number}</span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      bus.status === 'arrived' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {bus.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-sm">
                    <Navigation className="w-4 h-4 text-[#F2A93B]" />
                    <span>From: <strong>{bus.origin_park}</strong></span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Driver: <strong>{bus.driver_name || 'Unassigned'}</strong></span>
                  </div>
                  <a href={`tel:${bus.driver_phone}`} className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-2 rounded-xl text-blue-700 transition-colors">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Call Driver: <strong>{bus.driver_phone}</strong></span>
                  </a>
                </div>
              </div>

              {/* Waybills details inside this bus */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Expected / Arrived Waybills ({bus.waybills?.length || 0})
                  </h4>
                </div>

                {!bus.waybills || bus.waybills.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 rounded-xl p-4">
                    No waybills are associated with this bus manifest.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bus.waybills.map((wb, wbIdx) => (
                      <div key={`inc-wb-${wb.id || wbIdx}-${wbIdx}`} className="border border-slate-100 bg-[#FAFAFA] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-[#0A1F44] select-all">
                                {wb.tracking_code}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.2 rounded uppercase ${
                                wb.status === 'collected' ? 'bg-emerald-50 text-emerald-700' :
                                wb.status === 'arrived' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {wb.status}
                              </span>
                            </div>
                            <span className="text-xs text-slate-600 block">
                              {wb.item_description}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Receiver: <strong>{wb.receiver_name}</strong> ({wb.receiver_phone})
                            </span>
                          </div>
                        </div>

                        {bus.status === "arrived" && (
                          <div className="shrink-0">
                            {wb.status === "collected" ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-black px-3 py-2 rounded-xl">
                                <Check className="w-4 h-4" />
                                Collected ✓
                              </span>
                            ) : (
                              <button
                                onClick={() => setVerifyingWaybill({ id: wb.id, tracking_code: wb.tracking_code, receiver_name: wb.receiver_name })}
                                disabled={collectLoading !== null}
                                className="w-full sm:w-auto bg-[#F2A93B] hover:bg-[#d9922b] text-[#0A1F44] font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                Mark as Collected
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {bus.status === "departed" && (
                <div className="mt-6 border-t border-slate-50 pt-5">
                  <button
                    onClick={() => handleArriveBus(bus.id, bus.bus_number)}
                    disabled={actionLoading !== null}
                    className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                  >
                    {actionLoading === bus.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating Manifest...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Mark Bus as Arrived
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Security Verification Modal */}
      {verifyingWaybill && (
        <div className="fixed inset-0 bg-[#0A1F44]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="verify-collect-modal">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-6 relative border border-slate-100">
            <button
              onClick={() => { setVerifyingWaybill(null); setInputPhone(''); }}
              className="absolute top-5 right-5 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-[#F2A93B]">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0A1F44]">Security Verification</h3>
                <p className="text-xs text-slate-500">Waybill: <strong className="text-blue-600">{verifyingWaybill.tracking_code}</strong></p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
              <p className="font-extrabold flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                Flexible Verification Protocol:
              </p>
              <p className="text-amber-800">
                Ask <span className="font-bold">{verifyingWaybill.receiver_name}</span> for their <strong>Receiver Phone Number</strong> OR their secret <strong>6-digit Pickup PIN</strong>. Enter either below to authorize release.
              </p>
            </div>

            <form onSubmit={handleConfirmCollect} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Receiver Phone OR 6-Digit Pickup PIN
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter Receiver Phone OR 6-digit PIN"
                    value={inputPhone}
                    onChange={(e) => setInputPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[#0A1F44] focus:outline-none focus:border-[#F2A93B]"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setVerifyingWaybill(null); setInputPhone(''); }}
                  className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collectLoading !== null}
                  className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {collectLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-[#F2A93B]" />
                      Verify & Release
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
