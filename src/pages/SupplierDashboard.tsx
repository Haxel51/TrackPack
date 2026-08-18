import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSupplierStaffMyCompanies,
  getFleetTrips,
  switchSupplierStaffCompany,
  advanceTripCheckpoint
} from '../lib/api';
import { Logo } from '../components/Logo';
import {
  LogOut,
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  ArrowRight,
  ShieldCheck,
  Search,
  RefreshCw,
  FileText
} from 'lucide-react';

export const SupplierDashboard: React.FC = () => {
  const { user, token, logout, login } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [myCompanies, setMyCompanies] = useState<any[]>([]);
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'incoming' | 'at_plant' | 'history'>('incoming');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states for loading cargo
  const [loadingForms, setLoadingForms] = useState<{ [tripId: string]: { waybill: string; notes: string } }>({});

  const fetchMyCompanies = async () => {
    if (!token) return;
    try {
      const data = await getSupplierStaffMyCompanies(token);
      if (data && data.success) {
        setMyCompanies(data.companies || []);
        const active = data.companies?.find((c: any) => c.is_current) || data.companies?.[0];
        if (active) setCurrentCompany(active);
      }
    } catch (err) {
      console.error("Error fetching supplier companies:", err);
    }
  };

  const fetchTrips = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getFleetTrips(token);
      if (data && data.success) {
        setTrips(data.trips || []);
      } else {
        setError(data?.error || 'Failed to fetch trips queue.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMyCompanies();
      fetchTrips();
      const interval = setInterval(fetchTrips, 12000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const handleSwitchCompany = async (targetCompanyId: string) => {
    if (!token || targetCompanyId === currentCompany?.company_id) return;
    setSwitching(true);
    try {
      const data = await switchSupplierStaffCompany(token, targetCompanyId);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to switch transport partner.');

      login(token, data.user, 'supplier_staff');
      await fetchMyCompanies();
      await fetchTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to switch transport partner.');
    } finally {
      setSwitching(false);
    }
  };

  const handleSupplierCheckpoint = async (
    tripId: string,
    checkpoint: 'arrived_at_supplier' | 'cargo_loaded' | 'loaded_departed',
    extra?: { waybill_number?: string; notes?: string }
  ) => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    setActionInProgress(tripId);

    try {
      const data = await advanceTripCheckpoint(token, tripId, checkpoint, extra);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to update checkpoint.');

      if (checkpoint === 'arrived_at_supplier') {
        setSuccessMsg('✅ Truck Arrival Recorded: Truck is now queued in plant bay.');
        setActiveTab('at_plant');
      } else if (checkpoint === 'cargo_loaded') {
        setSuccessMsg('✅ Cargo Loading Confirmed: Waybill and seal recorded.');
      } else if (checkpoint === 'loaded_departed') {
        setSuccessMsg('✅ Departure Recorded: Truck marked as Dispatched & Left Plant.');
      }

      await fetchTrips();
    } catch (err: any) {
      setError(err.message || 'Failed to update checkpoint');
    } finally {
      setActionInProgress(null);
    }
  };

  const incomingQueue = trips.filter(t => t.status === 'left_warehouse');
  const atPlantQueue = trips.filter(t => t.status === 'arrived_at_supplier' || t.status === 'cargo_loaded');
  const historyQueue = trips.filter(t => t.status === 'loaded_departed' || t.status === 'arrived_at_destination' || t.status === 'completed');

  const filterList = (list: any[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(t =>
      (t.truck_number && t.truck_number.toLowerCase().includes(q)) ||
      (t.driver_name && t.driver_name.toLowerCase().includes(q)) ||
      (t.destination_name && t.destination_name.toLowerCase().includes(q)) ||
      (t.waybill_number && t.waybill_number.toLowerCase().includes(q))
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Top Navbar */}
      <nav className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700 px-6 py-4 sticky top-0 z-30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Logo size="sm" />
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-white">Supplier Plant Portal</h1>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                {user?.supplier_name || 'Plant Supervisor'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Logged in as <span className="text-slate-200 font-medium">{user?.name || 'Officer'}</span>
              {user?.company_name ? ` • Assigned Partner: ${user.company_name}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {myCompanies.length > 1 && (
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
              <Building2 className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-400 font-medium hidden sm:inline">Partner:</span>
              <select
                value={user?.company_id || currentCompany?.company_id || ''}
                onChange={(e) => handleSwitchCompany(e.target.value)}
                disabled={switching}
                className="bg-transparent text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
              >
                {myCompanies.map((c: any) => (
                  <option key={c.company_id} value={c.company_id} className="bg-slate-800 text-white">
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={() => {
              setLoading(true);
              fetchTrips();
            }}
            className="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={logout}
            className="flex items-center space-x-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Banner Alert */}
        {error && (
          <div className="bg-rose-950/80 border border-rose-700 text-rose-200 px-4 py-3 rounded-2xl text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold underline cursor-pointer ml-4">Dismiss</button>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-2xl text-xs flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold underline cursor-pointer ml-4">Dismiss</button>
          </div>
        )}

        {/* Status Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'incoming'
                ? 'bg-blue-950/60 border-blue-500 ring-2 ring-blue-500/30'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">1. Incoming Trucks</span>
              <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 text-xs font-black flex items-center justify-center border border-blue-400/30">
                {incomingQueue.length}
              </span>
            </div>
            <p className="text-xl font-black text-white mt-2">{incomingQueue.length} In Transit</p>
            <p className="text-[11px] text-slate-400 mt-1">Dispatched from depot en route to plant</p>
          </button>

          <button
            onClick={() => setActiveTab('at_plant')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'at_plant'
                ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/30'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">2. At Plant & Loading</span>
              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black flex items-center justify-center border border-amber-400/30">
                {atPlantQueue.length}
              </span>
            </div>
            <p className="text-xl font-black text-white mt-2">{atPlantQueue.length} In Bay</p>
            <p className="text-[11px] text-slate-400 mt-1">Arrived / Loading / Ready for dispatch</p>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-500/30'
                : 'bg-slate-800/80 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">3. Dispatched History</span>
              <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black flex items-center justify-center border border-emerald-400/30">
                {historyQueue.length}
              </span>
            </div>
            <p className="text-xl font-black text-white mt-2">{historyQueue.length} Dispatched</p>
            <p className="text-[11px] text-slate-400 mt-1">Loaded and dispatched back to depot</p>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by truck plate number, driver, destination..."
            className="w-full bg-slate-800 border border-slate-700 pl-11 pr-4 py-3 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
          />
        </div>

        {/* Tab 1: Incoming Trucks (Stage 2 -> Stage 3) */}
        {activeTab === 'incoming' && (
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-blue-400" />
                  <span>Trucks En Route To Our Plant</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm arrival when truck plate reaches the factory gate.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-slate-400 py-8 text-center text-xs">Loading queue...</p>
            ) : filterList(incomingQueue).length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Truck className="w-10 h-10 mx-auto text-blue-400/40 mb-3" />
                <p className="font-semibold text-slate-300 text-sm">No trucks currently en route to your plant.</p>
                <p className="text-xs text-slate-500 mt-1">Trucks marked departed from transport depots will show here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterList(incomingQueue).map(trip => (
                  <div key={trip.id} className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black px-3 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                          {trip.truck_number}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-300 bg-blue-950/80 border border-blue-800 px-2.5 py-1 rounded-lg flex items-center space-x-1">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>En Route</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Origin Depot</p>
                          <p className="text-white font-semibold mt-0.5">{trip.origin_name || trip.park_name || 'Depot'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Departed At</p>
                          <p className="text-slate-200 font-semibold mt-0.5">
                            {trip.left_warehouse_at ? new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                          </p>
                        </div>
                      </div>

                      {trip.driver_name && (
                        <p className="text-xs text-slate-400">
                          Driver: <strong className="text-slate-200">{trip.driver_name}</strong> {trip.driver_phone ? `(${trip.driver_phone})` : ''}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSupplierCheckpoint(trip.id, 'arrived_at_supplier')}
                      disabled={actionInProgress === trip.id}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>{actionInProgress === trip.id ? 'Recording Arrival...' : '1. Confirm Truck Arrived at Plant'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: At Plant & Loading Bay (Stage 3 & Stage 4) */}
        {activeTab === 'at_plant' && (
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Trucks Inside Our Plant / Bay</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Load cargo, record waybill/seal, and authorize outbound plant departure.
              </p>
            </div>

            {loading ? (
              <p className="text-slate-400 py-8 text-center text-xs">Loading bay queue...</p>
            ) : filterList(atPlantQueue).length === 0 ? (
              <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-slate-800">
                <Package className="w-10 h-10 mx-auto text-amber-400/40 mb-3" />
                <p className="font-semibold text-slate-300 text-sm">No trucks currently in the plant loading bay.</p>
                <p className="text-xs text-slate-500 mt-1">Trucks marked as arrived will appear here ready for cargo loading.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filterList(atPlantQueue).map(trip => {
                  const form = loadingForms[trip.id] || { waybill: trip.waybill_number || '', notes: trip.cargo_notes || '' };
                  const isLoaded = trip.status === 'cargo_loaded';

                  return (
                    <div key={trip.id} className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 space-y-4 shadow-lg flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black px-3 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            {trip.truck_number}
                          </span>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${
                            isLoaded
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                              : 'bg-amber-950/80 text-amber-300 border-amber-700'
                          }`}>
                            {isLoaded ? '📦 Loaded & Sealed' : '📍 In Bay (Awaiting Cargo)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Arrived at Plant</p>
                            <p className="text-slate-200 font-semibold mt-0.5">
                              {trip.arrived_at_supplier_at ? new Date(trip.arrived_at_supplier_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recorded'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Destination</p>
                            <p className="text-white font-semibold mt-0.5 truncate">{trip.destination_name || 'Depot Bay'}</p>
                          </div>
                        </div>

                        {/* If not loaded yet, show cargo form */}
                        {!isLoaded && (
                          <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                                Waybill / Seal # (Optional)
                              </label>
                              <input
                                type="text"
                                value={form.waybill}
                                onChange={(e) => setLoadingForms({
                                  ...loadingForms,
                                  [trip.id]: { ...form, waybill: e.target.value }
                                })}
                                placeholder="e.g. WB-IBETO-8834"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                                Cargo Note (e.g. 600 Bags Cement)
                              </label>
                              <input
                                type="text"
                                value={form.notes}
                                onChange={(e) => setLoadingForms({
                                  ...loadingForms,
                                  [trip.id]: { ...form, notes: e.target.value }
                                })}
                                placeholder="e.g. 600 bags Supaset 42.5R"
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                        )}

                        {isLoaded && (
                          <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl text-xs space-y-1">
                            <p className="text-emerald-300 font-bold flex items-center space-x-1.5">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span>Cargo Sealed & Ready for Exit</span>
                            </p>
                            {trip.waybill_number && (
                              <p className="text-slate-300 text-[11px]">Waybill: <strong className="text-white">{trip.waybill_number}</strong></p>
                            )}
                            {trip.cargo_notes && (
                              <p className="text-slate-300 text-[11px]">Details: {trip.cargo_notes}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2">
                        {!isLoaded ? (
                          <button
                            onClick={() => handleSupplierCheckpoint(trip.id, 'cargo_loaded', {
                              waybill_number: form.waybill,
                              notes: form.notes
                            })}
                            disabled={actionInProgress === trip.id}
                            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
                          >
                            <Package className="w-4 h-4" />
                            <span>{actionInProgress === trip.id ? 'Recording...' : '2. Confirm Cargo Loaded & Sealed'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSupplierCheckpoint(trip.id, 'loaded_departed')}
                            disabled={actionInProgress === trip.id}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors shadow-lg cursor-pointer disabled:opacity-50"
                          >
                            <Truck className="w-4 h-4" />
                            <span>{actionInProgress === trip.id ? 'Recording...' : '3. Mark Truck Dispatched & Left Plant'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: History */}
        {activeTab === 'history' && (
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <span>Plant Dispatch History</span>
            </h2>

            {filterList(historyQueue).length === 0 ? (
              <p className="text-slate-400 text-xs py-8 text-center">No historical dispatches yet.</p>
            ) : (
              <div className="space-y-3">
                {filterList(historyQueue).map(trip => (
                  <div key={trip.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-black text-amber-400 text-sm">{trip.truck_number}</span>
                        {trip.waybill_number && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                            WB: {trip.waybill_number}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Dispatched: {trip.loaded_departed_at ? new Date(trip.loaded_departed_at).toLocaleString() : 'N/A'}
                        {trip.loaded_departed_by ? ` by ${trip.loaded_departed_by}` : ''}
                      </p>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold self-start sm:self-auto ${
                      trip.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {trip.status === 'completed' ? 'DELIVERED & OFFLOADED' : 'EN ROUTE TO DESTINATION'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
