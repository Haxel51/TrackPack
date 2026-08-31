import React, { useState, useEffect } from 'react';
import { TripRecord } from '../types';
import { getTrips, updateTripStatus, getSubscriptionAlerts } from '../api';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import { CreateTripModal } from './CreateTripModal';
import { RedirectTripModal } from './RedirectTripModal';
import { ConfirmDepartureModal } from './ConfirmDepartureModal';
import { TripDetailView } from './TripDetailView';
import {
  Navigation,
  Plus,
  Search,
  Truck,
  Building2,
  MapPin,
  Phone,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Share2,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  Filter,
  Eye,
  Play,
} from 'lucide-react';

interface TripsManagementProps {
  token: string;
  role?: string;
  user?: any;
}

export const TripsManagement: React.FC<TripsManagementProps> = ({
  token,
  role,
  user,
}) => {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [subscriptionAlerts, setSubscriptionAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal & View states
  const [selectedTrip, setSelectedTrip] = useState<TripRecord | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [redirectingTrip, setRedirectingTrip] = useState<TripRecord | null>(null);
  const [departingTrip, setDepartingTrip] = useState<TripRecord | null>(null);
  const [isDepartingLoading, setIsDepartingLoading] = useState<boolean>(false);

  // Determine user permissions
  const fleetRole = getFleetRole(user, role);
  const canCreateTrip = FleetPermissions.canCreateTrip(fleetRole);
  const canConfirmDeparture = fleetRole === 'ceo' || fleetRole === 'manager';

  useEffect(() => {
    loadTrips();
    loadSubscriptionAlerts();
  }, [token]);

  const loadSubscriptionAlerts = async () => {
    if (!token) return;
    try {
      const res = await getSubscriptionAlerts(token);
      if (res.success && Array.isArray(res.alerts)) {
        setSubscriptionAlerts(res.alerts);
      }
    } catch {
      // ignore
    }
  };

  const loadTrips = async () => {
    setIsLoading(true);
    setError(null);

    const res = await getTrips(token);
    if (res.success) {
      setTrips(res.trips || []);
    } else {
      setError(res.error || 'Failed to load haulage trips');
    }
    setIsLoading(false);
  };

  const showSuccessNotice = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
  };

  const handleConfirmDeparture = async () => {
    if (!departingTrip) return;
    try {
      setIsDepartingLoading(true);
      const res = await updateTripStatus(
        token,
        departingTrip.id,
        'departed',
        'Truck departure confirmed by manager.'
      );
      if (res.success) {
        showSuccessNotice(`✅ Truck ${departingTrip.plate_number} departure confirmed! Status is now departed.`);
        setDepartingTrip(null);
        await loadTrips();
      } else {
        alert(res.error || 'Failed to confirm truck departure');
      }
    } catch (err: any) {
      alert(err?.message || 'Error confirming departure');
    } finally {
      setIsDepartingLoading(false);
    }
  };

  // Filtered trips
  const filteredTrips = trips.filter((t) => {
    const matchesSearch =
      t.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.primary_destination_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.redirect_destination?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return t.trip_status !== 'completed' && t.trip_status !== 'cancelled';
    if (statusFilter === 'redirected') return !!t.redirect_destination;
    if (statusFilter === 'completed') return t.trip_status === 'completed';
    if (statusFilter === 'cancelled') return t.trip_status === 'cancelled';

    return true;
  });

  // Get status badge styling
  const getTripStatusBadge = (status: string, hasRedirect: boolean) => {
    if (status === 'completed') {
      return { label: 'Completed', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    }
    if (status === 'cancelled') {
      return { label: 'Cancelled', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    }
    if (hasRedirect || status === 'redirected') {
      return { label: 'Redirected 🔀', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    }
    return { label: 'Active Trip 🚚', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
  };

  // If a trip card was selected, show the full screen map & details view
  if (selectedTrip) {
    return (
      <TripDetailView
        trip={selectedTrip}
        token={token}
        role={role}
        user={user}
        onBack={() => setSelectedTrip(null)}
        onTripUpdated={() => {
          loadTrips();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🚛</span>
            <h2 className="text-lg font-black text-white tracking-wide">Truck Trips & Dispatches</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch trucks from confirmed suppliers, manage redirects, and view live GPS tracking
          </p>
        </div>

        {canCreateTrip && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer shrink-0"
            id="create-trip-btn"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create New Trip</span>
          </button>
        )}
      </div>

      {/* Subscription Expiry Reminder Banners (for Manager / CEO) */}
      {subscriptionAlerts.length > 0 && (
        <div className="space-y-2">
          {subscriptionAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                alert.tier === 'critical' || alert.tier === 'urgent'
                  ? 'bg-rose-950/80 border-rose-500/50 text-rose-200 animate-pulse'
                  : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className={`w-5 h-5 shrink-0 ${alert.tier === 'critical' || alert.tier === 'urgent' ? 'text-rose-400' : 'text-amber-400'}`} />
                <div>
                  <div className="font-extrabold text-white text-xs">{alert.title}</div>
                  <div className="text-[11px] opacity-90">{alert.message}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubscriptionAlerts((prev) => prev.filter((_, i) => i !== idx))}
                className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-emerald-300 text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plate number, driver, destination..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            id="trips-search-input"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto scrollbar-none">
          {[
            { id: 'all', label: 'All Trips' },
            { id: 'active', label: 'Active' },
            { id: 'redirected', label: 'Redirected 🔀' },
            { id: 'completed', label: 'Completed' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white bg-slate-950/60 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Content Grid / List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <p className="text-xs font-bold">Loading fleet haulage trips...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-500/10 border border-rose-500/30 rounded-3xl text-center text-rose-300 text-xs font-bold space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
          <p>{error}</p>
          <button
            onClick={loadTrips}
            className="mt-2 text-amber-400 underline cursor-pointer text-xs"
          >
            Retry Loading Trips
          </button>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <Navigation className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-extrabold text-white">No Trips Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {trips.length === 0
              ? 'No haulage trips have been created yet. Managers can dispatch a new trip from confirmed supplier locations.'
              : 'No trips match your search or filter criteria.'}
          </p>
          {canCreateTrip && trips.length === 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Dispatch First Trip</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTrips.map((trip) => {
            const hasRedirect = !!trip.redirect_destination;
            const statusBadge = getTripStatusBadge(trip.trip_status, hasRedirect);
            const isCompletedOrCancelled = trip.trip_status === 'completed' || trip.trip_status === 'cancelled';

            return (
              <div
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-3xl p-5 shadow-lg flex flex-col justify-between gap-4 transition-all cursor-pointer group"
                id={`trip-card-${trip.id}`}
              >
                
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black shrink-0 group-hover:bg-amber-500/20 group-hover:scale-105 transition-all">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-base text-white tracking-wide group-hover:text-amber-400 transition-colors">{trip.plate_number}</span>
                      </div>
                      <div className="text-xs text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                        <span>Driver: {trip.driver_name}</span>
                        <a
                          href={`tel:${trip.driver_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-amber-400 hover:underline flex items-center gap-0.5 ml-1 text-[11px]"
                          title="Call Driver"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{trip.driver_phone}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex flex-col items-end gap-1">
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-extrabold ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      trip.payment_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      Payment: {trip.payment_status.toUpperCase()} (₦{trip.payment_amount.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Destinations Section */}
                <div className="space-y-2.5 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
                  
                  {/* Primary Supplier */}
                  <div className="flex items-start gap-2.5 text-xs">
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                        Primary Supplier Destination
                      </span>
                      <div className="font-extrabold text-white text-xs">{trip.primary_destination_name}</div>
                    </div>
                  </div>

                  {/* Redirect Destination if present */}
                  {hasRedirect && trip.redirect_destination && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2.5 text-xs">
                      <Navigation className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider">
                            Redirect Customer Destination 🔀
                          </span>
                          <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-black">
                            {trip.redirect_destination.type === 'saved_customer' ? 'SAVED' : 'NEW'}
                          </span>
                        </div>
                        <div className="font-extrabold text-white text-xs">{trip.redirect_destination.name}</div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{trip.redirect_destination.address}</span>
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Card Footer Info & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] border-t border-slate-800/80">
                  <div className="text-slate-400 font-medium flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-400 font-bold group-hover:underline">Tap to view map & live tracking</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Departure Button on Trip Card (for Manager/CEO) */}
                    {(trip.trip_status === 'created' || trip.trip_status === 'payment_confirmed') && canConfirmDeparture && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDepartingTrip(trip);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-950/40 hover:scale-105 active:scale-95"
                        id={`departure-btn-card-${trip.id}`}
                        title="Has the truck departed? Click to confirm departure."
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Has the truck departed? 🚛</span>
                      </button>
                    )}

                    {/* Redirect Button */}
                    {!isCompletedOrCancelled && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRedirectingTrip(trip);
                        }}
                        className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
                        id={`redirect-trip-btn-${trip.id}`}
                      >
                        <Navigation className="w-3.5 h-3.5 text-purple-400" />
                        <span>{hasRedirect ? 'Update Redirect 🔀' : 'Redirect Trip 🔀'}</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Create Trip */}
      <CreateTripModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        token={token}
        onTripCreated={(newTrip) => {
          setIsCreateModalOpen(false);
          loadTrips();
          if (newTrip) {
            setSelectedTrip(newTrip);
          }
          showSuccessNotice('✅ Trip created successfully! Live tracking is now active.');
        }}
      />

      {/* Modal 2: Redirect Trip */}
      <RedirectTripModal
        isOpen={!!redirectingTrip}
        onClose={() => setRedirectingTrip(null)}
        trip={redirectingTrip}
        token={token}
        onTripRedirected={(msg) => {
          showSuccessNotice(msg || 'Trip redirected successfully!');
          loadTrips();
        }}
      />

      {/* Modal 3: Confirm Departure Dialog */}
      <ConfirmDepartureModal
        isOpen={!!departingTrip}
        onClose={() => setDepartingTrip(null)}
        trip={departingTrip}
        isLoading={isDepartingLoading}
        onConfirmDeparture={handleConfirmDeparture}
      />

    </div>
  );
};
