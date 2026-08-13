import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { LogOut, Building2, Truck, CheckCircle2, Clock, MapPin } from 'lucide-react';

export const SupplierDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/fleet/trips', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch trips queue.');
      setTrips(data.trips || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token]);

  const handleMarkLoaded = async (tripId: string) => {
    if (!confirm('Confirm that this truck has arrived and is fully loaded & departed?')) return;
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/checkpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ checkpoint: 'loaded_departed' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update checkpoint.');
      fetchTrips();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const enRouteQueue = trips.filter(t => t.status === 'left_warehouse');
  const pastTrips = trips.filter(t => t.status !== 'left_warehouse');

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Logo size="sm" />
          <div>
            <h1 className="text-lg font-bold text-white">Supplier Portal</h1>
            <p className="text-xs text-slate-400">Welcome, {user?.name || 'Supplier Staff'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
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
              {enRouteQueue.map(trip => (
                <div key={trip.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300">
                      Truck: {trip.truck_number}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Left Warehouse: {new Date(trip.left_warehouse_at).toLocaleTimeString()}</span>
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Billing Type</p>
                    <p className="text-sm font-semibold capitalize">{trip.billing_method} (Status: {trip.payment_status})</p>
                  </div>

                  <button
                    onClick={() => handleMarkLoaded(trip.id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center space-x-2 transition-colors shadow-lg"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Mark Loaded & Departed</span>
                  </button>
                </div>
              ))}
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
