import React, { useState, useEffect } from 'react';
import { getFleetTrips, advanceTripCheckpoint } from '../../lib/api';
import { Truck, ArrowRight, ArrowLeft, CheckCircle2, Clock, AlertTriangle, RefreshCw, Search, ShieldCheck, MapPin, Building, Calendar } from 'lucide-react';

interface Trip {
  id: string;
  company_id: string;
  park_id?: string;
  truck_id: string;
  truck_number: string;
  supplier_id: string;
  supplier_name: string;
  status: 'pending_payment' | 'left_warehouse' | 'loaded_departed' | 'completed' | 'cancelled';
  billing_method?: string;
  trip_fee?: number;
  payment_status?: string;
  left_warehouse_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_offloaded_at?: string | null;
  created_at: string;
}

interface DepotGateControlProps {
  token: string;
  originPark: string;
  onBackToMenu: () => void;
}

export const DepotGateControl: React.FC<DepotGateControlProps> = ({
  token,
  originPark,
  onBackToMenu
}) => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'departing' | 'arriving' | 'completed'>('departing');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchTrips = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await getFleetTrips(token);
      if (data && data.success && Array.isArray(data.trips)) {
        setTrips(data.trips);
      }
    } catch {
      // Ignore background network blips
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTrips();
      const interval = setInterval(fetchTrips, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleCheckpoint = async (tripId: string, checkpoint: 'left_warehouse' | 'arrived_at_destination' | 'arrived_offloaded') => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    setActionInProgress(tripId);

    try {
      const data = await advanceTripCheckpoint(token, tripId, checkpoint);
      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to update truck status.');
      }

      if (checkpoint === 'left_warehouse') {
        setSuccessMsg('✅ Gate Departure Recorded: Truck marked as Left Depot (Outbound to Supplier).');
      } else if (checkpoint === 'arrived_at_destination') {
        setSuccessMsg('✅ Gate Arrival Recorded: Truck marked as Arrived at Depot Gate.');
      } else {
        setSuccessMsg('✅ Offloading Completed: Trip successfully marked as Arrived & Offloaded.');
      }

      await fetchTrips();
    } catch (err: any) {
      setError(err.message || 'An error occurred during gate verification.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Filter trucks by category
  const departingTrucks = trips.filter(
    t => t.status === 'pending_payment' || (t.status as string) === 'created' || (t.status as string) === 'trip_created'
  );

  const arrivingTrucks = trips.filter(
    t => t.status === 'loaded_departed' || (t.status as string) === 'arrived_at_destination'
  );

  const completedTrucks = trips.filter(
    t => t.status === 'completed'
  );

  const filterBySearch = (list: Trip[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      t =>
        t.truck_number.toLowerCase().includes(q) ||
        (t.supplier_name && t.supplier_name.toLowerCase().includes(q))
    );
  };

  const displayedDeparting = filterBySearch(departingTrucks);
  const displayedArriving = filterBySearch(arrivingTrucks);
  const displayedCompleted = filterBySearch(completedTrucks);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToMenu}
            className="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
            title="Back to Menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#0A1F44]">
                Depot Gate Checkpoint
              </h2>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">
                Warehouse Fleet
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F2A93B]" />
              <span>Current Depot Location: <strong>{originPark}</strong></span>
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setLoading(true);
            fetchTrips();
          }}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-2xl text-xs transition-colors cursor-pointer self-stretch sm:self-auto justify-center"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Gate Queue</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Metric Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab('departing')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] ${
            activeTab === 'departing'
              ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'departing' ? 'text-amber-300' : 'text-slate-500'}`}>
              Ready to Leave Depot
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              activeTab === 'departing'
                ? 'bg-white/20 text-white'
                : departingTrucks.length > 0 ? 'bg-amber-100 text-amber-800 font-bold' : 'bg-slate-100 text-slate-600'
            }`}>
              {departingTrucks.length}
            </span>
          </div>
          <div className="text-xl font-black mt-2">
            {departingTrucks.length} {departingTrucks.length === 1 ? 'Truck' : 'Trucks'}
          </div>
          <span className={`text-[10px] ${activeTab === 'departing' ? 'text-slate-300' : 'text-slate-400'}`}>
            Pending Gate Outbound Dispatch
          </span>
        </button>

        <button
          onClick={() => setActiveTab('arriving')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] ${
            activeTab === 'arriving'
              ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'arriving' ? 'text-amber-300' : 'text-slate-500'}`}>
              Returning to Depot
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              activeTab === 'arriving'
                ? 'bg-white/20 text-white'
                : arrivingTrucks.length > 0 ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-slate-100 text-slate-600'
            }`}>
              {arrivingTrucks.length}
            </span>
          </div>
          <div className="text-xl font-black mt-2">
            {arrivingTrucks.length} {arrivingTrucks.length === 1 ? 'Truck' : 'Trucks'}
          </div>
          <span className={`text-[10px] ${activeTab === 'arriving' ? 'text-slate-300' : 'text-slate-400'}`}>
            Loaded & Returning from Factory
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] ${
            activeTab === 'completed'
              ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${activeTab === 'completed' ? 'text-amber-300' : 'text-slate-500'}`}>
              Completed Trips
            </span>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
              activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {completedTrucks.length}
            </span>
          </div>
          <div className="text-xl font-black mt-2">
            {completedTrucks.length} {completedTrucks.length === 1 ? 'Trip' : 'Trips'}
          </div>
          <span className={`text-[10px] ${activeTab === 'completed' ? 'text-slate-300' : 'text-slate-400'}`}>
            Successfully Offloaded at Depot
          </span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by truck plate number or factory name..."
          className="w-full text-xs font-bold text-slate-800 placeholder-slate-400 bg-transparent focus:outline-hidden"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold"
          >
            Clear
          </button>
        )}
      </div>

      {/* Tab 1: Ready to Leave Depot (Gate Dispatch) */}
      {activeTab === 'departing' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#0A1F44] uppercase tracking-wide flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#F2A93B]" />
              Trucks Ready to Leave Depot ({displayedDeparting.length})
            </h3>
          </div>

          {displayedDeparting.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                <Truck className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-[#0A1F44]">No trucks awaiting departure</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When trips are assigned to trucks, they will appear here for gate staff to record departure from this depot.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedDeparting.map((trip) => {
                const isPaidOrMonthly = trip.payment_status === 'paid' || trip.payment_status === 'active_monthly' || trip.trip_fee === 0;
                return (
                  <div
                    key={trip.id}
                    className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4 hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                            Truck Plate Number
                          </span>
                          <span className="text-lg font-black text-[#0A1F44] flex items-center gap-1.5 mt-0.5">
                            <Truck className="w-4 h-4 text-blue-600" />
                            {trip.truck_number}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isPaidOrMonthly
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {isPaidOrMonthly ? '✓ Ready for Gate' : 'Payment Required'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            Target Factory:
                          </span>
                          <span className="font-extrabold text-[#0A1F44]">
                            {trip.supplier_name || 'Assigned Supplier'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            Scheduled:
                          </span>
                          <span className="font-bold text-slate-700">
                            {new Date(trip.created_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      id={`mark-left-depot-btn-${trip.id}`}
                      disabled={actionInProgress === trip.id || !isPaidOrMonthly}
                      onClick={() => handleCheckpoint(trip.id, 'left_warehouse')}
                      className={`w-full py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                        !isPaidOrMonthly
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-[#0A1F44] hover:bg-blue-900 text-white hover:shadow-md'
                      }`}
                    >
                      {actionInProgress === trip.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-[#F2A93B]" />
                      )}
                      <span>
                        {!isPaidOrMonthly ? 'Waiting on Fee Verification' : 'Mark Left Depot 🚀'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Returning to Depot (Gate Arrival & Offload) */}
      {activeTab === 'arriving' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#0A1F44] uppercase tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Trucks Returning from Factory ({displayedArriving.length})
            </h3>
          </div>

          {displayedArriving.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-[#0A1F44]">No trucks awaiting gate arrival</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When trucks are loaded and depart from the factory, they will show up here to be marked as arrived and offloaded at this depot.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedArriving.map((trip) => {
                const isAtDepotGate = (trip.status as string) === 'arrived_at_destination';

                return (
                  <div
                    key={trip.id}
                    className={`bg-white border-2 rounded-3xl p-5 shadow-sm space-y-4 transition-all flex flex-col justify-between ${
                      isAtDepotGate ? 'border-amber-400 bg-amber-50/20' : 'border-emerald-200 hover:border-emerald-400'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                            {isAtDepotGate ? 'At Depot Offloading Bay' : 'In-Transit to Depot'}
                          </span>
                          <span className="text-lg font-black text-[#0A1F44] flex items-center gap-1.5 mt-0.5">
                            <Truck className={`w-4 h-4 ${isAtDepotGate ? 'text-amber-600' : 'text-emerald-600'}`} />
                            {trip.truck_number}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isAtDepotGate
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                        }`}>
                          {isAtDepotGate ? 'At Depot Bay' : 'Loaded & Returning'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl space-y-1.5 text-xs border border-slate-100">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="flex items-center gap-1 font-semibold">
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            Supplier Origin:
                          </span>
                          <span className="font-extrabold text-[#0A1F44]">
                            {trip.supplier_name || 'Plant'}
                          </span>
                        </div>

                        {trip.loaded_departed_at && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="flex items-center gap-1 font-semibold">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              Left Supplier:
                            </span>
                            <span className="font-bold text-slate-700">
                              {new Date(trip.loaded_departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!isAtDepotGate ? (
                      <button
                        id={`mark-arrived-dest-btn-${trip.id}`}
                        disabled={actionInProgress === trip.id}
                        onClick={() => handleCheckpoint(trip.id, 'arrived_at_destination')}
                        className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        {actionInProgress === trip.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4 text-blue-200" />
                        )}
                        <span>1. Mark Truck Arrived at Depot Gate</span>
                      </button>
                    ) : (
                      <button
                        id={`mark-arrived-offloaded-btn-${trip.id}`}
                        disabled={actionInProgress === trip.id}
                        onClick={() => handleCheckpoint(trip.id, 'arrived_offloaded')}
                        className="w-full py-3 px-4 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm hover:shadow-md"
                      >
                        {actionInProgress === trip.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        )}
                        <span>2. Mark Offloaded & Complete Trip ✅</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Completed Trips */}
      {activeTab === 'completed' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-[#0A1F44] uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-600" />
              Completed Depot Trips ({displayedCompleted.length})
            </h3>
          </div>

          {displayedCompleted.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-black text-[#0A1F44]">No completed trips yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Completed fleet trips will be logged here with complete timestamps.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {displayedCompleted.map((trip) => (
                  <div key={trip.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-[#0A1F44]">{trip.truck_number}</span>
                          <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            Completed
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Supplier / Factory: <strong>{trip.supplier_name || 'N/A'}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right text-xs text-slate-500">
                      {trip.arrived_offloaded_at && (
                        <div>
                          Offloaded: <span className="font-bold text-slate-700">
                            {new Date(trip.arrived_offloaded_at).toLocaleString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
