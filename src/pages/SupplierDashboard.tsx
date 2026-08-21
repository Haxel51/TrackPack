import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSupplierStaffMyCompanies,
  getFleetTrips,
  advanceTripCheckpoint
} from '../lib/api';
import {
  LogOut,
  Building2,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Phone,
  AlertCircle,
  PackageCheck,
  ArrowRight
} from 'lucide-react';

export const SupplierDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchMyCompanies = async () => {
    if (!token) return;
    try {
      const data = await getSupplierStaffMyCompanies(token);
      if (data && data.success && data.companies?.length > 0) {
        const active = data.companies.find((c: any) => c.is_current) || data.companies[0];
        if (active) setCurrentCompany(active);
      }
    } catch (err) {
      console.error("Error fetching supplier info:", err);
    }
  };

  const fetchTrips = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await getFleetTrips(token);
      if (data && data.success) {
        setTrips(data.trips || []);
      }
    } catch (err: any) {
      console.error("Failed to fetch trips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMyCompanies();
      fetchTrips();
      const interval = setInterval(fetchTrips, 10000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Checkpoint 2: Mark Arrived at Depot
  const handleArrivedAtDepot = async (tripId: string) => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    setActionInProgress(tripId);

    try {
      const data = await advanceTripCheckpoint(token, tripId, 'arrived_at_depot');
      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to record Arrived at Depot checkpoint.');
      }
      setSuccessMsg('Truck marked as Arrived at Depot successfully.');
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchTrips();
    } catch (err: any) {
      setError(err.message || 'Failed to update checkpoint');
    } finally {
      setActionInProgress(null);
    }
  };

  // Checkpoint 3: Mark Loaded & Departed
  const handleLoadedAndDeparted = async (tripId: string) => {
    if (!token) return;
    setError(null);
    setSuccessMsg(null);
    setActionInProgress(tripId);

    try {
      const data = await advanceTripCheckpoint(token, tripId, 'loaded_departed');
      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to record Loaded & Departed checkpoint.');
      }
      setSuccessMsg('Truck marked as Loaded & Departed successfully.');
      setTimeout(() => setSuccessMsg(null), 5000);
      await fetchTrips();
    } catch (err: any) {
      setError(err.message || 'Failed to update checkpoint');
    } finally {
      setActionInProgress(null);
    }
  };

  // Trucks relevant to Depot Staff:
  // 1. En Route to Depot (Checkpoint 1: status 'departed', 'left_garage', 'left_warehouse', 'initiated')
  // 2. Arrived at Depot & Loading (Checkpoint 2: status 'arrived_at_depot', 'arrived_at_supplier')
  const depotTrucks = trips.filter(
    (t) =>
      t.status === 'departed' ||
      t.status === 'left_garage' ||
      t.status === 'left_warehouse' ||
      t.status === 'initiated' ||
      t.status === 'arrived_at_depot' ||
      t.status === 'arrived_at_supplier'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Minimal Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800/80 px-4 py-4 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">
                {currentCompany?.supplier_name || 'Supplier Depot'}
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {currentCompany?.company_name || 'Transport Partner'} • {user?.name || 'Staff'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); fetchTrips(); }}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60 transition-colors cursor-pointer"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Banner Alert Messages */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="text-lg font-extrabold text-white">Depot Truck Operations</h2>
            <p className="text-xs text-slate-400">
              Mark <strong>Checkpoint 2 ("Arrived at Depot")</strong> when the truck enters your bay, then <strong>Checkpoint 3 ("Loaded &amp; Departed")</strong> once goods are loaded.
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-xs rounded-full">
            {depotTrucks.length} Active
          </span>
        </div>

        {/* Loading Spinner */}
        {loading && trips.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Checking for depot trucks...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && depotTrucks.length === 0 && (
          <div className="p-10 rounded-3xl bg-slate-900/50 border border-slate-800/80 text-center space-y-3 mt-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-500 mx-auto">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-200">No Trucks Currently at or En Route to Depot</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When the transport partner dispatches a truck to your depot, it will appear here instantly.
            </p>
          </div>
        )}

        {/* Trucks List */}
        <div className="space-y-4">
          {depotTrucks.map((trip) => {
            const isSubmitting = actionInProgress === trip.id;
            const isAtDepot = trip.status === 'arrived_at_depot' || trip.status === 'arrived_at_supplier' || !!trip.arrived_at_supplier_at;
            const departureTime = trip.departed_at || trip.left_warehouse_at || trip.created_at;

            return (
              <div
                key={trip.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5"
              >
                {/* Truck Badge & Info */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isAtDepot
                        ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400'
                        : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                    }`}>
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-white tracking-tight">
                        {trip.truck_number || 'Truck'}
                      </h3>
                      <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <span>Driver: {trip.driver_name || 'Assigned Driver'}</span>
                        {trip.driver_phone && (
                          <a
                            href={`tel:${trip.driver_phone}`}
                            className="inline-flex items-center gap-0.5 text-amber-400 hover:underline ml-1"
                          >
                            <Phone className="w-3 h-3" /> {trip.driver_phone}
                          </a>
                        )}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-xl border ${
                    isAtDepot
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}>
                    {isAtDepot ? 'At Depot Bay' : 'En Route to Depot'}
                  </span>
                </div>

                {/* Details Grid with Real-time Destination updates */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Origin</span>
                    <span className="font-bold text-slate-200 truncate block mt-0.5">
                      {trip.origin_park || 'Company Garage'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px] font-medium">Final Destination</span>
                    <span className="font-bold text-amber-300 truncate block mt-0.5">
                      {trip.supplier_name || 'Destination'}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Left Garage: {departureTime ? new Date(departureTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Recently'}</span>
                    {trip.arrived_at_supplier_at && (
                      <span className="text-purple-300 font-bold">
                        Arrived Bay: {new Date(trip.arrived_at_supplier_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  {trip.self_learned_eta?.display && (
                    <div className="col-span-2 pt-1 border-t border-slate-800/60 flex items-center gap-1.5 text-amber-400 font-semibold text-[11px]">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{trip.self_learned_eta.display}</span>
                    </div>
                  )}
                </div>

                {/* Checkpoint Action Buttons based on stage */}
                {!isAtDepot ? (
                  /* Step 2: Mark Arrived at Depot */
                  <button
                    type="button"
                    onClick={() => handleArrivedAtDepot(trip.id)}
                    disabled={isSubmitting}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg shadow-purple-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <PackageCheck className="w-5 h-5" />
                        <span>Tap Checkpoint 2: Mark Arrived at Depot</span>
                      </>
                    )}
                  </button>
                ) : (
                  /* Step 3: Mark Loaded & Departed */
                  <button
                    type="button"
                    onClick={() => handleLoadedAndDeparted(trip.id)}
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 px-6 rounded-2xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Tap Checkpoint 3: Mark Loaded &amp; Departed</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default SupplierDashboard;
