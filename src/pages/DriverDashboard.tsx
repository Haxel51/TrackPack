import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { LogOut, Truck, MapPin, CheckCircle2, Clock, AlertTriangle, Send } from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState('');

  const fetchTrips = async () => {
    try {
      const res = await fetch('/api/fleet/trips', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch trips.');
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

  const handleShareLocation = async (tripId: string, source: 'proactive' | 'requested') => {
    setSharing(true);
    try {
      const res = await fetch(`/api/fleet/trips/${tripId}/share-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ note: note.trim() || 'Driver live location update', source })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to share location.');
      setNote('');
      fetchTrips();
      alert('Location successfully shared and recorded against the trip!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSharing(false);
    }
  };

  const activeTrip = trips.find(t => t.status !== 'completed');

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Logo size="sm" />
          <div>
            <h1 className="text-lg font-bold text-white">Driver Portal</h1>
            <p className="text-xs text-slate-400">Welcome, {user?.name || 'Driver'}</p>
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

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
          <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
            <Truck className="w-6 h-6 text-amber-400" />
            <span>Assigned Fleet Trips</span>
          </h2>

          {loading ? (
            <p className="text-slate-400">Loading trips...</p>
          ) : error ? (
            <p className="text-red-400">{error}</p>
          ) : trips.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-400" />
              <p>No trips currently assigned to your truck.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {trips.map(trip => {
                const isOverdue = trip.status === 'left_warehouse' && trip.left_warehouse_at && (new Date().getTime() - new Date(trip.left_warehouse_at).getTime() > 3600000);
                return (
                  <div key={trip.id} className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300">
                          Truck: {trip.truck_number}
                        </span>
                        <h3 className="text-lg font-bold mt-2 text-white">Destination: {trip.supplier_name}</h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        trip.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                        trip.status === 'loaded_departed' ? 'bg-blue-500/20 text-blue-300' :
                        trip.status === 'left_warehouse' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {trip.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {isOverdue && (
                      <div className="bg-red-950/60 border border-red-500 text-red-200 p-4 rounded-xl flex items-start space-x-3">
                        <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm">Overdue Checkpoint Alert</p>
                          <p className="text-xs mt-1 text-red-300">This trip has passed its expected window by over 1 hour. Please share your one-time live location below.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div>
                        <p><span className="text-slate-500">Billing:</span> {trip.billing_method.toUpperCase()} (₦{trip.trip_fee})</p>
                        <p><span className="text-slate-500">Payment:</span> {trip.payment_status.toUpperCase()}</p>
                      </div>
                      <div>
                        <p><span className="text-slate-500">Created:</span> {new Date(trip.created_at).toLocaleString()}</p>
                        {trip.left_warehouse_at && <p><span className="text-slate-500">Left Warehouse:</span> {new Date(trip.left_warehouse_at).toLocaleTimeString()}</p>}
                      </div>
                    </div>

                    {/* Location sharing section */}
                    {trip.status !== 'completed' && (
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <label className="block text-sm font-medium text-slate-300">Share Live Location / Status Note</label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="e.g., Stuck in traffic around Onitsha bypass..."
                            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <button
                            onClick={() => handleShareLocation(trip.id, isOverdue ? 'requested' : 'proactive')}
                            disabled={sharing}
                            className="bg-amber-400 hover:bg-amber-300 text-slate-900 px-5 py-2 rounded-xl text-sm font-bold flex items-center space-x-1 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-4 h-4" />
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Location history shares */}
                    {trip.location_shares && trip.location_shares.length > 0 && (
                      <div className="mt-4 bg-slate-800/60 rounded-xl p-3">
                        <p className="text-xs font-semibold text-slate-400 mb-2">Location Share History ({trip.location_shares.length})</p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {trip.location_shares.map((share: any, idx: number) => (
                            <div key={idx} className="text-xs text-slate-300 flex justify-between items-center bg-slate-900/50 p-2 rounded-lg">
                              <span>{share.note}</span>
                              <span className="text-slate-500">{new Date(share.timestamp).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
