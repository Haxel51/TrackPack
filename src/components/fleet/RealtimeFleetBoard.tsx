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
import { FleetTripCard } from './FleetTripCard';
import { FleetTripTimelineModal } from './FleetTripTimelineModal';
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
  status: 'pending_payment' | 'created' | 'trip_created' | 'left_warehouse' | 'arrived_at_supplier' | 'cargo_loaded' | 'loaded_departed' | 'arrived_at_destination' | 'completed';
  billing_method: 'per_trip' | 'monthly';
  trip_fee: number;
  payment_status: 'pending' | 'paid' | 'active_monthly';
  payment_reference?: string | null;
  left_warehouse_at?: string | null;
  left_warehouse_by?: string | null;
  arrived_at_supplier_at?: string | null;
  arrived_at_supplier_by?: string | null;
  cargo_loaded_at?: string | null;
  cargo_loaded_by?: string | null;
  loaded_departed_at?: string | null;
  loaded_departed_by?: string | null;
  arrived_at_destination_at?: string | null;
  arrived_at_destination_by?: string | null;
  arrived_offloaded_at?: string | null;
  arrived_offloaded_by?: string | null;
  waybill_number?: string | null;
  cargo_notes?: string | null;
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
        <div className="grid grid-cols-1 gap-3.5" id="fleet-trip-list">
          {filteredTrips.map((trip, idx) => {
            const driver = getDriverForTruck(trip.truck_id);
            return (
              <FleetTripCard
                key={trip.id}
                id={idx === 0 ? "fleet-trip-card-first" : undefined}
                trip={trip}
                driver={driver}
                onSelect={(selected) => setSelectedTrip(selected as Trip)}
              />
            );
          })}
        </div>
      )}

      {/* 1-TAP DETAILED FLEET TRIP TIMELINE MODAL */}
      {selectedTrip && (
        <FleetTripTimelineModal
          trip={selectedTrip}
          driver={getDriverForTruck(selectedTrip.truck_id)}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
};
