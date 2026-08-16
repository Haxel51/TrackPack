import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getSupplierStaffMyCompanies,
  getFleetTrips,
  switchSupplierStaffCompany,
  advanceTripCheckpoint
} from '../lib/api';
import { Logo } from '../components/Logo';
import { LogOut, Building2, Truck, CheckCircle2, Clock, MapPin } from 'lucide-react';

export const SupplierDashboard: React.FC = () => {
  const { user, token, logout, login } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [myCompanies, setMyCompanies] = useState<any[]>([]);
  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleMarkLoaded = async (tripId: string) => {
    if (!token) return;
    if (!confirm('Confirm that this truck has arrived and is fully loaded & departed?')) return;
    try {
      const data = await advanceTripCheckpoint(token, tripId, 'loaded_departed');
      if (!data || !data.success) throw new Error(data?.error || 'Failed to update checkpoint.');
      fetchTrips();
    } catch (err: any) {
      alert(err.message || 'Failed to update checkpoint');
    }
  };

  const enRouteQueue = trips.filter(t => t.status === 'left_warehouse');
  const pastTrips = trips.filter(t => t.status !== 'left_warehouse');

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Logo size="sm" />
          <div>
            <h1 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>Supplier Portal</span>
              {user?.company_name && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">
                  {user.company_name}
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400">
              Logged in as <span className="text-slate-200 font-medium">{user?.name || 'Supplier Staff'}</span>
              {user?.supplier_name ? ` (${user.supplier_name})` : ''}
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
            onClick={logout}
            className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* En Route Live Queue */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center space-x-2 text-amber-400">
            <Truck className="w-6 h-6" />
            <span>Trucks Currently En Route To Us ({enRouteQueue.length})</span>
          </h2>

          {loading ? (
            <p className="text-slate-400">Loading incoming queue...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : enRouteQueue.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-900/50 rounded-xl border border-slate-800">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-400" />
              <p className="font-medium">No trucks currently en route to your depot.</p>
              <p className="text-xs text-slate-500 mt-1">Trucks dispatched from transport company warehouses will appear here automatically.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enRouteQueue.map(trip => {
                // Calculate expected arrival time at depot (12-hour AM/PM readable format)
                let expectedArrivalFormatted = 'Pending departure';
                if (trip.left_warehouse_at) {
                  const leftMs = new Date(trip.left_warehouse_at).getTime();
                  const durationMins = trip.expected_duration_minutes || 180;
                  const etaMs = leftMs + (durationMins / 2) * 60 * 1000;
                  expectedArrivalFormatted = new Date(etaMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                }

                const departureFormatted = trip.left_warehouse_at
                  ? new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
                  : 'N/A';

                return (
                  <div key={trip.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Truck: {trip.truck_number}
                      </span>
                      <span className="text-xs font-semibold text-blue-300 bg-blue-950/60 border border-blue-800/80 px-2.5 py-1 rounded-lg flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-blue-400" />
                        <span>Expected: {expectedArrivalFormatted}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/70 p-3 rounded-lg border border-slate-800/80">
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-[10px]">Origin</p>
                        <p className="text-white font-semibold mt-0.5">{trip.origin_name || trip.park_name || user?.company_name || 'Transport Depot'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 font-bold uppercase text-[10px]">Departed At</p>
                        <p className="text-slate-200 font-semibold mt-0.5">{departureFormatted}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleMarkLoaded(trip.id)}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 transition-colors shadow-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Mark Loaded & Departed</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Past / Completed Queue */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-slate-300">Trip History & Processed Queue</h2>
          {pastTrips.length === 0 ? (
            <p className="text-slate-400 text-sm">No historical trips yet.</p>
          ) : (
            <div className="space-y-3">
              {pastTrips.map(trip => (
                <div key={trip.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-bold text-amber-400">Truck {trip.truck_number}</span>
                    <p className="text-xs text-slate-400 mt-0.5">Created: {new Date(trip.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    trip.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    trip.status === 'loaded_departed' ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {trip.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
