import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  getFleetTrips,
  getFleetDrivers,
  getFleetTrucks,
  getFleetSuppliers,
  advanceTripCheckpoint
} from '../../lib/api';
import { getFleetTripNarrative } from '../../lib/fleetNarrative';
import {
  Truck,
  Building2,
  MapPin,
  Clock,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Phone,
  Calendar,
  ShieldCheck,
  ArrowRight,
  User,
  DollarSign,
  Activity,
  FileText,
  ChevronRight,
  X,
  Play,
  Navigation,
  Check
} from 'lucide-react';

interface Trip {
  id: string;
  company_id: string;
  park_id: string;
  truck_id: string;
  truck_number: string;
  supplier_id: string;
  supplier_name: string;
  status: 'pending_payment' | 'left_warehouse' | 'loaded_departed' | 'completed';
  billing_method: 'per_trip' | 'monthly';
  trip_fee: number;
  payment_status: 'pending' | 'paid' | 'active_monthly';
  payment_reference?: string | null;
  left_warehouse_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_offloaded_at?: string | null;
  expected_duration_minutes?: number;
  location_shares?: Array<{ timestamp: string; note: string; source?: string }>;
  created_at: string;
}

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  truck_id?: string;
  park_id?: string;
  initial_pin?: string;
}

interface TruckItem {
  id: string;
  truck_number: string;
  park_id?: string;
  billing_method: 'per_trip' | 'monthly';
}

interface Supplier {
  id: string;
  name: string;
}

interface RealtimeFleetBoardProps {
  userRole?: 'company' | 'manager' | 'staff' | 'supplier_staff';
  onTripSelect?: (trip: Trip) => void;
  compact?: boolean;
}

export const RealtimeFleetBoard: React.FC<RealtimeFleetBoardProps> = ({
  userRole = 'company',
  onTripSelect,
  compact = false
}) => {
  const { token } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending_payment' | 'left_warehouse' | 'loaded_departed' | 'completed'>('active');

  // Modal Detail State
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [updatingCheckpoint, setUpdatingCheckpoint] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async (isManualRefresh = false) => {
    if (!token) {
      if (isMountedRef.current) {
        setLoading(false);
      }
      return;
    }
    if (isManualRefresh) setRefreshing(true);
    try {
      const [tripsRes, driversRes, trucksRes, suppRes] = await Promise.allSettled([
        getFleetTrips(token),
        getFleetDrivers(token),
        getFleetTrucks(token),
        getFleetSuppliers(token)
      ]);

      if (!isMountedRef.current) return;

      if (tripsRes.status === 'fulfilled' && tripsRes.value && tripsRes.value.success) {
        setTrips(tripsRes.value.trips || []);
      }
      if (driversRes.status === 'fulfilled' && driversRes.value && driversRes.value.success) {
        setDrivers(driversRes.value.drivers || []);
      }
      if (trucksRes.status === 'fulfilled' && trucksRes.value && trucksRes.value.success) {
        setTrucks(trucksRes.value.trucks || []);
      }
      if (suppRes.status === 'fulfilled' && suppRes.value && suppRes.value.success) {
        setSuppliers(suppRes.value.suppliers || []);
      }

      setLastUpdated(new Date());
    } catch {
      // Graceful fallback for transient network drops
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      // Real-time polling every 10 seconds for live truck board updates
      const interval = setInterval(() => {
        fetchData();
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token]);

  // Helper function to match driver for a truck
  const getDriverForTruck = (truckId: string) => {
    return drivers.find(d => d.truck_id === truckId);
  };

  // Checkpoint manual override handler
  const handleAdvanceCheckpoint = async (tripId: string, nextCheckpoint: 'left_warehouse' | 'loaded_departed' | 'arrived_offloaded') => {
    if (!token) return;
    setUpdatingCheckpoint(true);
    try {
      const res = await advanceTripCheckpoint(token, tripId, nextCheckpoint);
      if (!res.success) {
        alert(res.error || 'Failed to update checkpoint');
        return;
      }

      // Refresh list
      await fetchData();
      if (selectedTrip && selectedTrip.id === tripId) {
        const updated = trips.find(t => t.id === tripId);
        if (updated) setSelectedTrip(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating checkpoint');
    } finally {
      if (isMountedRef.current) {
        setUpdatingCheckpoint(false);
      }
    }
  };

  // Helper for step status
  const getStepProgress = (status: Trip['status']) => {
    switch (status) {
      case 'pending_payment':
        return 1;
      case 'left_warehouse':
        return 2;
      case 'loaded_departed':
        return 3;
      case 'completed':
        return 4;
      default:
        return 1;
    }
  };

  // Calculate ETA remaining string
  const calculateETA = (trip: Trip) => {
    const startTimeStr = trip.loaded_departed_at || trip.left_warehouse_at || trip.created_at;
    if (!startTimeStr) return 'Pending Departure';
    if (trip.status === 'completed') {
      if (trip.arrived_offloaded_at && trip.created_at) {
        const diffMs = new Date(trip.arrived_offloaded_at).getTime() - new Date(trip.created_at).getTime();
        const hrs = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `Completed in ${hrs > 0 ? `${hrs}h ` : ''}${mins}m`;
      }
      return 'Completed';
    }

    const durationMins = trip.expected_duration_minutes || 180;
    const startTime = new Date(startTimeStr).getTime();
    const etaTime = startTime + durationMins * 60 * 1000;
    const now = Date.now();
    const diffMs = etaTime - now;

    if (diffMs <= 0) {
      const overMins = Math.abs(Math.floor(diffMs / (1000 * 60)));
      return `Overdue by ~${overMins} mins`;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `~${hours > 0 ? `${hours}h ` : ''}${mins}m remaining`;
  };

  // Get Last Updated Checkpoint description
  const getLastUpdatedInfo = (trip: Trip) => {
    if (trip.status === 'completed' && trip.arrived_offloaded_at) {
      return {
        label: 'Arrived & Offloaded',
        time: new Date(trip.arrived_offloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(trip.arrived_offloaded_at).toLocaleDateString()
      };
    }
    if (trip.status === 'loaded_departed' && trip.loaded_departed_at) {
      return {
        label: `Loaded @ ${trip.supplier_name}`,
        time: new Date(trip.loaded_departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(trip.loaded_departed_at).toLocaleDateString()
      };
    }
    if (trip.status === 'left_warehouse' && trip.left_warehouse_at) {
      return {
        label: 'Departed Depot / En Route',
        time: new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(trip.left_warehouse_at).toLocaleDateString()
      };
    }
    return {
      label: 'Trip Initiated',
      time: new Date(trip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(trip.created_at).toLocaleDateString()
    };
  };

  // Filtering trips
  const filteredTrips = trips.filter(trip => {
    // Status filter
    if (statusFilter === 'active' && trip.status === 'completed') return false;
    if (statusFilter !== 'all' && statusFilter !== 'active' && trip.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const driver = getDriverForTruck(trip.truck_id);
      const matchesTruck = trip.truck_number.toLowerCase().includes(q);
      const matchesSupplier = trip.supplier_name.toLowerCase().includes(q);
      const matchesDriver = driver ? driver.name.toLowerCase().includes(q) || driver.phone_number.includes(q) : false;
      return matchesTruck || matchesSupplier || matchesDriver;
    }
    return true;
  });

  // Calculate counters
  const totalTrucksCount = trucks.length;
  const activeEnRouteCount = trips.filter(t => t.status === 'left_warehouse' || t.status === 'loaded_departed').length;
  const loadingAtFactoryCount = trips.filter(t => t.status === 'loaded_departed').length;
  const completedTripsCount = trips.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* HEADER METRICS BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-xl">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white tracking-tight">Real-Time Fleet Board</h2>
                <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
                  LIVE FIRESTORE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring active round-trip haulage trucks, driver location logs & arrival estimates
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
            <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Board'}</span>
            </button>
          </div>
        </div>

        {/* SUMMARY STAT CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Fleet Trucks</p>
            <p className="text-2xl font-black text-white mt-1">{totalTrucksCount}</p>
            <span className="text-[10px] text-amber-400 font-medium">Registered units</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active En Route</p>
            <p className="text-2xl font-black text-blue-400 mt-1">{activeEnRouteCount}</p>
            <span className="text-[10px] text-blue-300 font-medium">Trucks on highway</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Loaded at Factory</p>
            <p className="text-2xl font-black text-amber-400 mt-1">{loadingAtFactoryCount}</p>
            <span className="text-[10px] text-amber-300 font-medium">Supplier loading bays</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completed Trips</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{completedTripsCount}</p>
            <span className="text-[10px] text-emerald-300 font-medium">Offloaded & returned</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by truck plate (e.g. LAG-452-XZ), driver name or supplier..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'active', label: 'Active Trips' },
            { id: 'all', label: 'All Trips' },
            { id: 'left_warehouse', label: 'Departed Depot' },
            { id: 'loaded_departed', label: 'Loaded @ Factory' },
            { id: 'completed', label: 'Completed' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* TRUCK LISTING / FLEET BOARD CARDS */}
      {loading ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-300">Loading Real-Time Fleet Board...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <Truck className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-base font-bold text-slate-300">No active truck trips match your filter</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchQuery ? 'Try clearing your search query.' : 'Initiate new fleet trips under the Trips tab to start real-time tracking.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map(trip => {
            const driver = getDriverForTruck(trip.truck_id);
            const currentStep = getStepProgress(trip.status);
            const etaString = calculateETA(trip);
            const lastUpdatedInfo = getLastUpdatedInfo(trip);
            const latestLocationShare = trip.location_shares && trip.location_shares.length > 0
              ? trip.location_shares[trip.location_shares.length - 1]
              : null;
            const narrativeInfo = getFleetTripNarrative(trip);

            return (
              <div
                key={trip.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-xl transition-all space-y-5"
              >
                {/* OVERDUE CHECKPOINT WARNING BANNER */}
                {narrativeInfo.isOverdue && narrativeInfo.overdueWarning && (
                  <div className="bg-amber-950/70 border border-amber-500/80 rounded-xl p-3.5 flex items-start space-x-3 text-amber-200 shadow-lg animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Overdue Checkpoint Alert</p>
                        {driver && (
                          <a
                            href={`tel:${driver.phone_number}`}
                            className="text-[11px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-0.5 rounded-lg border border-amber-500/40 flex items-center space-x-1 transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call Driver ({driver.phone_number})</span>
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-medium text-amber-100 leading-relaxed">
                        {narrativeInfo.overdueWarning}
                      </p>
                    </div>
                  </div>
                )}

                {/* TOP HEADER: TRUCK PLATE, SUPPLIER & BADGES */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-slate-800 text-amber-400 rounded-xl border border-slate-700 shrink-0">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-lg font-black text-white tracking-wide">{trip.truck_number}</span>
                        <span className="text-xs text-slate-400 font-semibold">→</span>
                        <span className="text-sm font-bold text-amber-300 flex items-center space-x-1">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{trip.supplier_name}</span>
                        </span>
                      </div>

                      {/* Driver & Phone Info */}
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1 flex-wrap gap-y-1">
                        {driver ? (
                          <span className="flex items-center space-x-1 text-slate-300 font-medium">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>Driver: <strong>{driver.name}</strong></span>
                            <a
                              href={`tel:${driver.phone_number}`}
                              className="text-amber-400 hover:underline flex items-center space-x-0.5 ml-1.5"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{driver.phone_number}</span>
                            </a>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No assigned driver</span>
                        )}
                        <span>•</span>
                        <span>Billing: <strong className="text-slate-200">{trip.billing_method.toUpperCase()}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* ETA & STATUS BADGE */}
                  <div className="flex items-end md:items-end flex-col space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        trip.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : trip.status === 'loaded_departed'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : trip.status === 'left_warehouse'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {trip.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold">{etaString}</span>
                    </div>
                  </div>
                </div>

                {/* 7-STAGE EXECUTIVE VABTRAC JOURNEY TIMELINE */}
                <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-amber-400" />
                      <span>7-Stage Journey Tracking</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                      Stage {
                        trip.status === 'completed' ? 7 :
                        trip.status === 'loaded_departed' ? 5 :
                        trip.status === 'left_warehouse' ? 3 : 1
                      } of 7
                    </span>
                  </div>

                  {/* Dynamic Progress Bar */}
                  <div className="relative w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500 h-full transition-all duration-500 rounded-full"
                      style={{
                        width: `${
                          trip.status === 'completed' ? 100 :
                          trip.status === 'loaded_departed' ? 72 :
                          trip.status === 'left_warehouse' ? 42 : 15
                        }%`
                      }}
                    />
                  </div>

                  {/* 7 Vertical Milestones */}
                  <div className="relative pl-6 space-y-4 border-l-2 border-slate-800 ml-2 pt-1">
                    {/* Stage 1 */}
                    <div className="relative space-y-0.5">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-slate-950 font-black" />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white">1. Trip Booked & Assigned</p>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                          {trip.created_at ? new Date(trip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Confirmed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Truck & driver dispatched to {trip.supplier_name}</p>
                    </div>

                    {/* Stage 2 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.left_warehouse_at ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.left_warehouse_at ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold ${trip.left_warehouse_at ? 'text-white' : 'text-slate-500'}`}>2. Departed Origin Depot</p>
                        {trip.left_warehouse_at && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            {new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {trip.left_warehouse_at ? 'Officially departed company warehouse' : 'Awaiting departure clearance'}
                      </p>
                    </div>

                    {/* Stage 3 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.left_warehouse_at && !trip.loaded_departed_at ? 'bg-blue-500 animate-pulse' : trip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.loaded_departed_at ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <Activity className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <p className={`text-xs font-bold ${trip.left_warehouse_at ? 'text-white' : 'text-slate-500'}`}>3. In-Transit to Supplier</p>
                      <p className="text-[11px] text-slate-400">
                        {trip.left_warehouse_at ? `Highway transit in progress toward ${trip.supplier_name}` : 'Pending departure'}
                      </p>
                    </div>

                    {/* Stage 4 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.loaded_departed_at ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                      </div>
                      <p className={`text-xs font-bold ${trip.loaded_departed_at ? 'text-white' : 'text-slate-500'}`}>4. Arrived at Supplier / Factory</p>
                      <p className="text-[11px] text-slate-400">
                        {trip.loaded_departed_at ? `Gate check-in verified at ${trip.supplier_name}` : `Awaiting arrival at ${trip.supplier_name}`}
                      </p>
                    </div>

                    {/* Stage 5 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.loaded_departed_at ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold ${trip.loaded_departed_at ? 'text-white' : 'text-slate-500'}`}>5. Loaded & Cleared</p>
                        {trip.loaded_departed_at && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            {new Date(trip.loaded_departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {trip.loaded_departed_at ? `Cargo loaded & weighbridge clearance authorized at ${trip.supplier_name}` : 'Pending factory loading'}
                      </p>
                    </div>

                    {/* Stage 6 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.status === 'loaded_departed' ? 'bg-blue-500 animate-pulse' : trip.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.status === 'completed' ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <Activity className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <p className={`text-xs font-bold ${trip.loaded_departed_at ? 'text-white' : 'text-slate-500'}`}>6. In-Transit Return / Delivering</p>
                      <p className="text-[11px] text-slate-400">
                        {trip.loaded_departed_at ? 'Truck returning with loaded cargo' : 'Awaiting factory exit'}
                      </p>
                    </div>

                    {/* Stage 7 */}
                    <div className="relative space-y-0.5">
                      <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                        trip.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}>
                        {trip.status === 'completed' ? <Check className="w-2.5 h-2.5 text-slate-950 font-black" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-xs font-bold ${trip.status === 'completed' ? 'text-white' : 'text-slate-500'}`}>7. Offloaded & Trip Completed</p>
                        {trip.arrived_offloaded_at && (
                          <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            {new Date(trip.arrived_offloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {trip.status === 'completed' ? 'Cargo received and trip finalized' : 'Awaiting destination offloading'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* HUMAN-READABLE CHECKPOINT STATUS NARRATIVE */}
                <div className={`p-4 rounded-xl border flex items-start space-x-3 transition-all ${
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
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Live Status Summary
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        trip.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : trip.status === 'loaded_departed'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : trip.status === 'left_warehouse'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {narrativeInfo.headline}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-relaxed">
                      "{narrativeInfo.narrative}"
                    </p>
                  </div>
                </div>

                {/* BOTTOM FOOTER: LAST UPDATE & QUICK ACTIONS */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="space-y-0.5 text-xs">
                    <p className="text-slate-300 font-semibold flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Last Checkpoint: <strong className="text-white">{lastUpdatedInfo.label}</strong></span>
                      <span className="text-slate-500">({lastUpdatedInfo.time})</span>
                    </p>

                    {latestLocationShare && (
                      <p className="text-[11px] text-slate-400 italic flex items-center space-x-1">
                        <Navigation className="w-3 h-3 text-blue-400 shrink-0" />
                        <span>Driver Broadcast: "{latestLocationShare.note}" ({new Date(latestLocationShare.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                    {/* Checkpoint Override Buttons for CEO/Manager */}
                    {['company', 'manager'].includes(userRole) && trip.status !== 'completed' && (
                      <>
                        {trip.status === 'pending_payment' && (
                          <button
                            onClick={() => handleAdvanceCheckpoint(trip.id, 'left_warehouse')}
                            disabled={updatingCheckpoint}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>Mark Left Depot</span>
                          </button>
                        )}
                        {trip.status === 'left_warehouse' && (
                          <button
                            onClick={() => handleAdvanceCheckpoint(trip.id, 'loaded_departed')}
                            disabled={updatingCheckpoint}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <Building2 className="w-3 h-3" />
                            <span>Mark Loaded @ Factory</span>
                          </button>
                        )}
                        {trip.status === 'loaded_departed' && (
                          <button
                            onClick={() => handleAdvanceCheckpoint(trip.id, 'arrived_offloaded')}
                            disabled={updatingCheckpoint}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Mark Completed</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => setSelectedTrip(trip)}
                      className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Audit Waybill</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL WAYBILL AUDIT TIMELINE MODAL */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">Fleet Trip Waybill Audit</span>
                <h3 className="text-2xl font-black text-white mt-1">Truck: {selectedTrip.truck_number}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Destination: {selectedTrip.supplier_name}</p>
              </div>
              <button
                onClick={() => setSelectedTrip(null)}
                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TRIP DETAILS & METRICS */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Billing Method</p>
                <p className="text-sm font-extrabold text-white mt-0.5">{selectedTrip.billing_method.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Payment Status</p>
                <p className={`text-sm font-extrabold mt-0.5 ${
                  selectedTrip.payment_status === 'paid' || selectedTrip.payment_status === 'active_monthly'
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}>
                  {selectedTrip.payment_status.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase">Estimated Duration</p>
                <p className="text-sm font-extrabold text-white mt-0.5">
                  {selectedTrip.expected_duration_minutes || 180} mins (~3 hours)
                </p>
              </div>
            </div>

            {/* MODAL NARRATIVE & OVERDUE BANNER */}
            {(() => {
              const modalNarrative = getFleetTripNarrative(selectedTrip);
              return (
                <div className="space-y-3">
                  {modalNarrative.isOverdue && modalNarrative.overdueWarning && (
                    <div className="bg-amber-950/70 border border-amber-500/80 rounded-2xl p-4 flex items-start space-x-3 text-amber-200">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Overdue Checkpoint Alert</p>
                        <p className="text-xs font-medium text-amber-100 mt-1 leading-relaxed">{modalNarrative.overdueWarning}</p>
                      </div>
                    </div>
                  )}

                  <div className={`p-4 rounded-2xl border flex items-start space-x-3 ${
                    selectedTrip.status === 'completed'
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
                      : selectedTrip.status === 'loaded_departed'
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                      : selectedTrip.status === 'left_warehouse'
                      ? 'bg-blue-950/30 border-blue-500/40 text-blue-100'
                      : 'bg-slate-950/60 border-slate-800 text-slate-200'
                  }`}>
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                      {selectedTrip.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : selectedTrip.status === 'loaded_departed' ? (
                        <Building2 className="w-5 h-5 text-amber-400" />
                      ) : selectedTrip.status === 'left_warehouse' ? (
                        <Truck className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Live Status Description
                      </span>
                      <p className="text-sm font-semibold leading-relaxed">
                        "{modalNarrative.narrative}"
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* CHECKPOINT TIMELINE STAGES */}
            <div className="space-y-4">
              <h4 className="text-sm font-extrabold text-slate-200 flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>7-Stage Fleet Journey Audit Log</span>
              </h4>

              <div className="space-y-4 relative pl-4 border-l-2 border-slate-800 ml-2">
                {/* 1. Trip Booked & Assigned */}
                <div className="relative pl-6 space-y-0.5">
                  <div className="absolute -left-[23px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-slate-950 font-black" />
                  </div>
                  <p className="text-xs font-bold text-white">1. Trip Booked & Assigned</p>
                  <p className="text-[11px] text-slate-400">
                    Timestamp: {new Date(selectedTrip.created_at).toLocaleString()}
                  </p>
                </div>

                {/* 2. Departed Origin Depot */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.left_warehouse_at ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">2. Departed Origin Depot</p>
                  <p className="text-[11px] text-slate-400">
                    Timestamp: {selectedTrip.left_warehouse_at ? new Date(selectedTrip.left_warehouse_at).toLocaleString() : 'Pending departure'}
                  </p>
                </div>

                {/* 3. In-Transit to Supplier */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.left_warehouse_at && !selectedTrip.loaded_departed_at ? 'bg-blue-500 animate-pulse' : selectedTrip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">3. In-Transit to Supplier</p>
                  <p className="text-[11px] text-slate-400">
                    Status: {selectedTrip.left_warehouse_at ? `Highway transit en route to ${selectedTrip.supplier_name}` : 'Awaiting transit start'}
                  </p>
                </div>

                {/* 4. Arrived at Supplier / Factory */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">4. Arrived at Supplier / Factory</p>
                  <p className="text-[11px] text-slate-400">
                    Status: {selectedTrip.loaded_departed_at ? `Checked in at ${selectedTrip.supplier_name}` : 'Awaiting arrival'}
                  </p>
                </div>

                {/* 5. Loaded & Cleared */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.loaded_departed_at ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">5. Loaded & Cleared</p>
                  <p className="text-[11px] text-slate-400">
                    Timestamp: {selectedTrip.loaded_departed_at ? new Date(selectedTrip.loaded_departed_at).toLocaleString() : 'Pending weighbridge clearance'}
                  </p>
                </div>

                {/* 6. In-Transit Return / Delivering */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.status === 'loaded_departed' ? 'bg-blue-500 animate-pulse' : selectedTrip.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">6. In-Transit Return / Delivering</p>
                  <p className="text-[11px] text-slate-400">
                    Status: {selectedTrip.status === 'loaded_departed' ? 'Returning with loaded cargo' : selectedTrip.status === 'completed' ? 'Return completed' : 'Awaiting departure from factory'}
                  </p>
                </div>

                {/* 7. Offloaded & Trip Completed */}
                <div className="relative pl-6 space-y-0.5">
                  <div className={`absolute -left-[23px] top-0.5 w-4 h-4 rounded-full border-2 border-slate-900 ${
                    selectedTrip.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-800'
                  }`} />
                  <p className="text-xs font-bold text-white">7. Offloaded & Trip Completed</p>
                  <p className="text-[11px] text-slate-400">
                    Timestamp: {selectedTrip.arrived_offloaded_at ? new Date(selectedTrip.arrived_offloaded_at).toLocaleString() : 'Pending final offloading'}
                  </p>
                </div>
              </div>
            </div>

            {/* DRIVER LOCATION BROADCAST LOGS */}
            <div className="space-y-3">
              <h4 className="text-sm font-extrabold text-slate-200 flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span>Driver Live Location Broadcasts</span>
              </h4>

              {selectedTrip.location_shares && selectedTrip.location_shares.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {selectedTrip.location_shares.map((share, idx) => (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[10px]">
                        <span className="font-bold text-amber-400">{share.source === 'requested' ? 'Requested Update' : 'Driver Location Update'}</span>
                        <span>{new Date(share.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-200 font-medium">{share.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic bg-slate-950 p-3 rounded-xl border border-slate-800">
                  No location broadcasts logged by driver for this trip yet.
                </p>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedTrip(null)}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-lg transition-all cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
