import React, { useState, useEffect } from 'react';
import { TripRecord } from '../types';
import { getTrips, updateTripStatus, getSubscriptionAlerts } from '../api';
import { getFleetRole, FleetPermissions } from '../utils/permissions';
import { getHumanTripStatusBadge, getHumanPaymentStatus } from '../utils/statusFormatters';
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

  // Get status badge styling with human-friendly language
  const getTripStatusBadge = (status: string, hasRedirect: boolean) => {
    return getHumanTripStatusBadge(status, hasRedirect);
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
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🚛</span>
            <h2 className="text-lg font-black text-[#0A1F44] tracking-wide">Fleet Trips & Dispatches</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Dispatch fleet assets, manage cargo destinations, redirects, and monitor live GPS tracker routes.
          </p>
        </div>

        {canCreateTrip && (
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-black px-6 py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0A1F44]/20 hover:scale-[1.02] active:scale-98 cursor-pointer shrink-0 border border-[#15346A]"
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
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertCircle className={`w-5 h-5 shrink-0 ${alert.tier === 'critical' || alert.tier === 'urgent' ? 'text-rose-600' : 'text-[#F7941D]'}`} />
                <div>
                  <div className="font-extrabold text-slate-900 text-xs">{alert.title}</div>
                  <div className="text-[11px] opacity-90 font-medium">{alert.message}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSubscriptionAlerts((prev) => prev.filter((_, i) => i !== idx))}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-emerald-800 text-xs font-bold animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search plate number, driver, destination, waybill..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-[#F7941D] focus:bg-white rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
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
                  ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trips Content Grid / List */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-3xl shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-[#F7941D]" />
          <p className="text-xs font-bold text-slate-500">Loading fleet haulage trips...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 border border-rose-200 rounded-3xl text-center text-rose-800 text-xs font-bold space-y-2">
          <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" />
          <p>{error}</p>
          <button
            onClick={loadTrips}
            className="mt-2 text-[#0A1F44] underline cursor-pointer text-xs font-bold"
          >
            Retry Loading Trips
          </button>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Navigation className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-extrabold text-slate-900">No Trips Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {trips.length === 0
              ? 'No haulage trips have been created yet. Managers can dispatch a new trip from confirmed locations.'
              : 'No trips match your search or filter criteria.'}
          </p>
          {canCreateTrip && trips.length === 0 && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-black px-5 py-2.5 rounded-xl text-xs cursor-pointer inline-flex items-center gap-2 shadow-md"
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
            const publicTrackUrl = `${window.location.origin}/track/fleet/${trip.id}`;

            return (
              <div
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className="bg-white border border-slate-200 hover:border-[#F7941D] rounded-3xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between gap-4 transition-all cursor-pointer group"
                id={`trip-card-${trip.id}`}
              >
                
                {/* Card Top Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0A1F44] text-[#F7941D] flex items-center justify-center font-black shrink-0 group-hover:scale-105 transition-all shadow-xs">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-[#0A1F44] tracking-wide group-hover:text-[#F7941D] transition-colors">
                          {trip.plate_number}
                        </span>
                        {trip.waybill_number && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {trip.waybill_number}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-0.5">
                        <span>Driver: {trip.driver_name}</span>
                        <a
                          href={`tel:${trip.driver_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#0A1F44] hover:underline flex items-center gap-0.5 ml-1 text-[11px] font-bold"
                          title="Call Driver"
                        >
                          <Phone className="w-3 h-3 text-[#F7941D]" />
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
                      trip.payment_status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}>
                      {getHumanPaymentStatus(trip.payment_status)} (₦{trip.payment_amount.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Cargo Manifest Summary */}
                {(trip.cargo_type || trip.cargo_quantity || trip.seal_number) && (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/60 text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[10px] font-black uppercase text-[#0A1F44]">Cargo:</span>
                      <span className="font-bold text-slate-900 truncate">
                        {trip.cargo_type || 'Freight'}{trip.cargo_quantity ? ` (${trip.cargo_quantity})` : ''}
                      </span>
                    </div>
                    {trip.seal_number && (
                      <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                        🔒 {trip.seal_number}
                      </span>
                    )}
                  </div>
                )}

                {/* Destinations Section */}
                <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  
                  {/* Primary Supplier */}
                  <div className="flex items-start gap-2.5 text-xs">
                    <Building2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                        Primary Loading / Delivery Hub
                      </span>
                      <div className="font-extrabold text-slate-900 text-xs">{trip.primary_destination_name}</div>
                    </div>
                  </div>

                  {/* Redirect Destination if present */}
                  {hasRedirect && trip.redirect_destination && (
                    <div className="pt-2 border-t border-slate-200 flex items-start gap-2.5 text-xs">
                      <Navigation className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">
                            Redirect Destination 🔀
                          </span>
                          <span className="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-black">
                            {trip.redirect_destination.type === 'saved_customer' ? 'SAVED' : 'NEW'}
                          </span>
                        </div>
                        <div className="font-extrabold text-slate-900 text-xs">{trip.redirect_destination.name}</div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{trip.redirect_destination.address}</span>
                        </p>
                      </div>
                    </div>
                  )}

                </div>

                {/* Card Footer Info & Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] border-t border-slate-100">
                  <div className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#F7941D]" />
                    <span className="text-[#0A1F44] font-bold group-hover:text-[#F7941D] transition-colors">
                      Tap for live map & telemetry
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Share Customer Link Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(publicTrackUrl);
                        showSuccessNotice(`📋 Customer Tracking Link for ${trip.plate_number} copied to clipboard!`);
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px]"
                      title="Copy Customer Share Link"
                    >
                      <Share2 className="w-3 h-3 text-[#0A1F44]" />
                      <span>Share</span>
                    </button>

                    {/* Departure Button on Trip Card (for Manager/CEO) */}
                    {(trip.trip_status === 'created' || trip.trip_status === 'payment_confirmed') && canConfirmDeparture && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDepartingTrip(trip);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs hover:scale-105 active:scale-95 text-[10px]"
                        id={`departure-btn-card-${trip.id}`}
                        title="Has the vehicle departed? Click to confirm departure."
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Departed? 🚛</span>
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
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 text-[10px]"
                        id={`redirect-trip-btn-${trip.id}`}
                      >
                        <Navigation className="w-3 h-3 text-purple-600" />
                        <span>{hasRedirect ? 'Update 🔀' : 'Redirect 🔀'}</span>
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
