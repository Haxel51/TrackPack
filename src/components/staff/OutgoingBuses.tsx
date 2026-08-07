import React, { useState, useEffect } from 'react';
import { getOutgoingBuses, departBus, getUnassignedWaybills, assignWaybillToBus } from '../../lib/api';
import { Bus, Waybill } from '../../types';
import { Truck, ArrowLeft, Loader2, Phone, User, FileText, CheckCircle, Navigation, Sparkles } from 'lucide-react';

interface OutgoingBusesProps {
  token: string;
  onBackToMenu: () => void;
}

export const OutgoingBuses: React.FC<OutgoingBusesProps> = ({ token, onBackToMenu }) => {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [unassignedWaybills, setUnassignedWaybills] = useState<Waybill[]>([]);
  const [activeTab, setActiveTab] = useState<'buses' | 'unassigned'>('buses');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // tracks busId being departed or waybillId being assigned
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [busesRes, waybillsRes] = await Promise.all([
        getOutgoingBuses(token),
        getUnassignedWaybills(token)
      ]);

      if (busesRes.success && busesRes.buses) {
        setBuses(busesRes.buses);
      } else {
        setError(busesRes.error || 'Failed to load outgoing buses.');
      }

      if (waybillsRes.success && waybillsRes.waybills) {
        setUnassignedWaybills(waybillsRes.waybills);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while fetching outgoing manifest data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDepartBus = async (busId: string, busNumber: string) => {
    setActionLoading(busId);
    setConfirmationMessage(null);
    setError(null);

    try {
      const res = await departBus(token, busId);
      if (res.success) {
        setConfirmationMessage(`Bus ${busNumber} marked as departed successfully. ${res.count} waybills updated to in-transit.`);
        await fetchData();
      } else {
        setError(res.error || `Failed to mark bus ${busNumber} as departed.`);
      }
    } catch (err) {
      console.error(err);
      setError(`An error occurred while updating bus ${busNumber}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignWaybill = async (waybillId: string, busId: string) => {
    setActionLoading(waybillId);
    setConfirmationMessage(null);
    setError(null);

    try {
      const res = await assignWaybillToBus(token, waybillId, busId);
      if (res.success) {
        setConfirmationMessage('Waybill assigned to bus manifest successfully.');
        await fetchData();
      } else {
        setError(res.error || 'Failed to assign waybill to bus.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while assigning waybill.');
    } finally {
      setActionLoading(null);
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
            Outgoing Bus Manifests
          </h2>
          <p className="text-xs text-slate-500">Manage pending bus dispatches leaving from your park</p>
        </div>
      </div>

      {confirmationMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-5 py-4 rounded-2xl flex items-start gap-3 shadow-sm">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold">Manifest Updated</h4>
            <p className="text-xs text-emerald-700 mt-1">{confirmationMessage}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-100 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab('buses')}
          className={`flex-1 pb-4 text-sm font-extrabold border-b-2 transition-all ${
            activeTab === 'buses'
              ? 'border-[#0A1F44] text-[#0A1F44]'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Active Loading Buses ({buses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('unassigned')}
          className={`flex-1 pb-4 text-sm font-extrabold border-b-2 transition-all flex items-center justify-center gap-2 ${
            activeTab === 'unassigned'
              ? 'border-[#0A1F44] text-[#0A1F44]'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Unassigned Waybills ({unassignedWaybills.length})
          {unassignedWaybills.length > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
              {unassignedWaybills.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Loading outgoing manifest queues...</span>
        </div>
      ) : activeTab === 'buses' ? (
        buses.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-[#0A1F44]">No Outgoing Buses</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are currently no active buses in 'loading' status departing from this station.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {buses.map((bus, busIdx) => {
              const destinationUnassigned = unassignedWaybills.filter(
                w => w.destination_park === bus.destination_park
              );

              return (
                <div key={`out-bus-${bus.id || busIdx}-${busIdx}`} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-5 mb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-[#0A1F44]">{bus.bus_number}</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                          {bus.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <Navigation className="w-4 h-4 text-[#F2A93B]" />
                        <span>To: <strong>{bus.destination_park}</strong></span>
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

                  {/* Waybills loaded inside this bus */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                        Waybills on Board ({bus.waybills?.length || 0})
                      </h4>
                    </div>

                    {!bus.waybills || bus.waybills.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 rounded-xl p-4">
                        No waybills have been assigned to this bus manifest yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2">
                        {bus.waybills.map((wb, wbIdx) => (
                          <div key={`out-wb-${wb.id || wbIdx}-${wbIdx}`} className="border border-slate-100 hover:border-slate-200 bg-[#FAFAFA] rounded-2xl p-3.5 flex items-start gap-3 transition-colors">
                            <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <span className="text-xs font-black text-[#0A1F44] block select-all">
                                {wb.tracking_code}
                              </span>
                              <span className="text-[10px] text-slate-500 block truncate max-w-[180px]">
                                {wb.item_description}
                              </span>
                              <span className="text-[9px] text-slate-400 block">
                                Recv: {wb.receiver_name} ({wb.receiver_phone})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unassigned paid waybills waiting for this destination */}
                  <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#F2A93B]" />
                        Unassigned Waybills bound for {bus.destination_park} ({destinationUnassigned.length})
                      </h4>
                    </div>

                    {destinationUnassigned.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50/50 rounded-2xl p-4">
                        No unassigned waybills currently waiting for {bus.destination_park}.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {destinationUnassigned.map((wb, wbIdx) => (
                          <div 
                            key={`unassigned-wb-${wb.id || wbIdx}-${wbIdx}`} 
                            className="border border-blue-100 bg-blue-50/20 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-blue-50/40 transition-colors"
                          >
                            <div className="flex items-start gap-3 text-left">
                              <FileText className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="text-xs font-extrabold text-[#0A1F44] block select-all">
                                  {wb.tracking_code}
                                </span>
                                <span className="text-xs text-slate-600 block">
                                  <strong>Description:</strong> {wb.item_description}
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Sender: {wb.sender_name} ({wb.sender_phone}) &middot; Recv: {wb.receiver_name}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAssignWaybill(wb.id, bus.id)}
                              disabled={actionLoading !== null}
                              className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-3.5 py-2 rounded-xl text-[11px] transition-colors cursor-pointer flex items-center gap-1 shrink-0 self-end sm:self-center disabled:opacity-50"
                            >
                              {actionLoading === wb.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <span>+ Load onto Bus</span>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {bus.waybills && bus.waybills.length > 0 && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <button
                        onClick={() => handleDepartBus(bus.id, bus.bus_number)}
                        disabled={actionLoading !== null}
                        className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        {actionLoading === bus.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating Waybills...
                          </>
                        ) : (
                          <>
                            <Truck className="w-4 h-4" />
                            Mark Bus as Departed
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* UNASSIGNED TAB VIEW */
        unassignedWaybills.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-4 shadow-sm">
            <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-[#0A1F44]">All Shipments Loaded</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are currently no unassigned paid waybills at your station. Every booked waybill has been registered to an active bus.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {unassignedWaybills.map((wb, idx) => {
              // Find buses going to the SAME destination park
              const validBuses = buses.filter(b => b.destination_park === wb.destination_park);
              
              return (
                <div key={`unassigned-${wb.id || idx}`} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#0A1F44] font-black text-sm select-all">{wb.tracking_code}</span>
                      <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {wb.origin_park} &rarr; {wb.destination_park}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 font-semibold">{wb.item_description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                      <div>Sender: <strong className="text-slate-700 font-bold">{wb.sender_name}</strong> ({wb.sender_phone})</div>
                      <div>Receiver: <strong className="text-slate-700 font-bold">{wb.receiver_name}</strong> ({wb.receiver_phone})</div>
                    </div>
                  </div>

                  <div className="shrink-0 w-full md:w-auto bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 min-w-[240px]">
                    <div className="text-xs font-black text-slate-500 uppercase tracking-wider">
                      Load onto Active Bus:
                    </div>
                    {validBuses.length === 0 ? (
                      <div className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3 font-medium">
                        ⚠️ No active buses loading for <strong className="font-extrabold text-[#0A1F44]">{wb.destination_park}</strong>.
                      </div>
                    ) : (
                      <select
                        id={`bus-select-${wb.id}`}
                        className="w-full bg-white border border-slate-200 focus:border-[#0A1F44] rounded-xl px-3 py-2 text-xs focus:outline-none transition-colors"
                        defaultValue=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleAssignWaybill(wb.id, val);
                          }
                        }}
                      >
                        <option value="" disabled>-- Choose Bus Manifest --</option>
                        {validBuses.map((b) => (
                          <option key={b.id} value={b.id}>
                            🚌 Bus {b.bus_number} (Driver: {b.driver_name || 'N/A'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
