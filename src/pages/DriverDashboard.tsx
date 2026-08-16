import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFleetTrips, changeDriverPin, shareDriverLocation } from '../lib/api';
import { getFleetTripNarrative } from '../lib/fleetNarrative';
import { Logo } from '../components/Logo';
import { LogOut, Truck, MapPin, CheckCircle2, Clock, AlertTriangle, Send, KeyRound, Building2 } from 'lucide-react';

export const DriverDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState('');

  // Change PIN modal state
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPin.trim().length !== 6 || !/^\d+$/.test(newPin.trim())) {
      setPinError("New PIN must be exactly 6 digits.");
      return;
    }
    setPinSubmitting(true);
    setPinError(null);
    setPinSuccess(null);
    try {
      const data = await changeDriverPin(token, currentPin, newPin);
      if (!data || !data.success) throw new Error(data?.error || 'Failed to change PIN.');
      setPinSuccess("Your 6-digit PIN has been successfully updated!");
      setCurrentPin('');
      setNewPin('');
      setTimeout(() => {
        setShowChangePin(false);
        setPinSuccess(null);
      }, 1800);
    } catch (err: any) {
      setPinError(err.message || 'Error updating PIN.');
    } finally {
      setPinSubmitting(false);
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
        setError(data?.error || 'Failed to fetch trips.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchTrips();
  }, [token]);

  const handleShareLocation = async (tripId: string, source: 'proactive' | 'requested') => {
    if (!token) return;
    setSharing(true);
    try {
      const data = await shareDriverLocation(token, tripId, {
        note: note.trim() || 'Driver live location update',
        source
      });
      if (!data || !data.success) throw new Error(data?.error || 'Failed to share location.');
      setNote('');
      fetchTrips();
      alert('Location successfully shared and recorded against the trip!');
    } catch (err: any) {
      alert(err.message || 'Failed to share location');
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
        <div className="flex items-center space-x-3">
          <button
            onClick={() => { setShowChangePin(true); setPinError(null); setPinSuccess(null); }}
            className="flex items-center space-x-1.5 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change My PIN</span>
          </button>
          <button
            onClick={logout}
            className="flex items-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
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
                const narrativeInfo = getFleetTripNarrative(trip);
                const isOverdue = narrativeInfo.isOverdue;

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

                    {/* OVERDUE WARNING BANNER */}
                    {isOverdue && narrativeInfo.overdueWarning && (
                      <div className="bg-amber-950/70 border border-amber-500/80 text-amber-200 p-4 rounded-xl flex items-start space-x-3 shadow-lg animate-pulse">
                        <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm text-amber-300">Overdue Checkpoint Alert</p>
                          <p className="text-xs mt-1 text-amber-100 leading-relaxed">{narrativeInfo.overdueWarning}</p>
                          <p className="text-[11px] mt-2 text-amber-300 font-semibold">Please broadcast your location note below so your fleet manager has real-time visibility.</p>
                        </div>
                      </div>
                    )}

                    {/* WARM HUMAN-READABLE DRIVER STATUS NARRATIVE */}
                    <div className={`p-4 rounded-xl border flex items-start space-x-3 ${
                      trip.status === 'completed'
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                        : trip.status === 'loaded_departed'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                        : trip.status === 'left_warehouse'
                        ? 'bg-blue-950/30 border-blue-500/40 text-blue-100'
                        : 'bg-slate-950/60 border-slate-800 text-slate-200'
                    }`}>
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                        {trip.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : trip.status === 'loaded_departed' ? (
                          <Building2 className="w-5 h-5 text-amber-400" />
                        ) : trip.status === 'left_warehouse' ? (
                          <Truck className="w-5 h-5 text-blue-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div className="space-y-1 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Current Trip Status
                        </span>
                        <p className="text-sm font-semibold leading-relaxed">
                          "{narrativeInfo.narrative}"
                        </p>
                      </div>
                    </div>

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

      {/* Change PIN Modal */}
      {showChangePin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Change 6-Digit Driver PIN</span>
              </h3>
              <button
                onClick={() => setShowChangePin(false)}
                className="text-slate-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {pinError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-300 text-xs font-semibold">
                {pinError}
              </div>
            )}

            {pinSuccess && (
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-semibold">
                {pinSuccess}
              </div>
            )}

            <form onSubmit={handleChangePin} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1">Current 6-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="Enter current PIN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-1">New 6-Digit PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Enter new 6-digit PIN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={pinSubmitting}
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold py-2.5 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
                >
                  {pinSubmitting ? 'Updating PIN...' : 'Save New PIN'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangePin(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
