import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Truck,
  Building2,
  MapPin,
  Clock,
  User,
  Phone,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getFleetTrips,
  getFleetDrivers,
  getFleetTrucks,
  getFleetSuppliers,
  advanceTripCheckpoint
} from '../../lib/api';
import { FleetTripTimelineModal } from './FleetTripTimelineModal';
import { FleetTripCard } from './FleetTripCard';
import { FleetInterferenceAlertBanner } from './FleetInterferenceAlertBanner';

interface Driver {
  id: string;
  name: string;
  phone_number: string;
  truck_id?: string;
  status?: string;
}

interface TruckType {
  id: string;
  truck_number: string;
  park_id?: string;
  billing_method?: 'per_trip' | 'monthly';
  monthly_active_until?: string;
}

interface Supplier {
  id: string;
  name: string;
  address?: string;
}

interface Trip {
  id: string;
  truck_id: string;
  truck_number: string;
  supplier_id: string;
  supplier_name: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  origin_park?: string;
  status: 'pending_payment' | 'created' | 'initiated' | 'left_garage' | 'departed' | 'left_warehouse' | 'arrived_at_depot' | 'arrived_at_supplier' | 'cargo_loaded' | 'loaded_departed' | 'arrived_at_destination' | 'completed' | 'arrived_offloaded' | string;
  billing_method: 'per_trip' | 'monthly' | string;
  trip_fee?: number;
  payment_status?: string;
  created_at: string;
  departed_at?: string | null;
  left_warehouse_at?: string | null;
  arrived_at_supplier_at?: string | null;
  loaded_departed_at?: string | null;
  arrived_at_destination_at?: string | null;
  completed_at?: string | null;
  arrived_offloaded_at?: string | null;
  waybill_number?: string | null;
  expected_duration_minutes?: number;
  self_learned_eta?: {
    display?: string;
    sample_size?: number;
    is_learned?: boolean;
  };
  audit_notes?: string[];
  location_shares?: Array<{ timestamp: string; note: string; source?: string }>;
}

interface RealtimeFleetBoardProps {
  onNewTripClick?: () => void;
  onPayTrip?: (tripId: string) => void;
}

export const RealtimeFleetBoard: React.FC<RealtimeFleetBoardProps> = ({
  onNewTripClick,
  onPayTrip
}) => {
  const { token, user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'left_garage' | 'arrived_at_depot' | 'loaded_departed' | 'arrived_at_destination' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [updatingCheckpoint, setUpdatingCheckpoint] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = async (isManual = false) => {
    if (!token) return;
    if (isManual) setRefreshing(true);
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
      // Graceful fallback
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
      const interval = setInterval(() => {
        fetchData();
      }, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [token]);

  const getDriverForTruck = (truckId: string) => {
    return drivers.find(d => d.truck_id === truckId);
  };

  // Filtering trips
  const filteredTrips = trips.filter(trip => {
    const isComp = trip.status === 'completed' || trip.status === 'arrived_offloaded' || !!trip.completed_at;
    if (statusFilter === 'active' && isComp) return false;
    if (statusFilter === 'completed' && !isComp) return false;
    if (statusFilter === 'left_garage' && trip.status !== 'left_garage' && trip.status !== 'departed' && trip.status !== 'left_warehouse') return false;
    if (statusFilter === 'arrived_at_depot' && trip.status !== 'arrived_at_depot' && trip.status !== 'arrived_at_supplier') return false;
    if (statusFilter === 'loaded_departed' && trip.status !== 'loaded_departed' && trip.status !== 'cargo_loaded') return false;
    if (statusFilter === 'arrived_at_destination' && trip.status !== 'arrived_at_destination') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const driver = getDriverForTruck(trip.truck_id);
      const matchesTruck = (trip.truck_number || '').toLowerCase().includes(q);
      const matchesSupplier = (trip.supplier_name || '').toLowerCase().includes(q);
      const matchesDriver = driver ? driver.name.toLowerCase().includes(q) || driver.phone_number.includes(q) : false;
      return matchesTruck || matchesSupplier || matchesDriver;
    }
    return true;
  });

  // Calculate counters across 5 checkpoints
  const totalTrucksCount = trucks.length;
  const leftGarageCount = trips.filter(t => t.status === 'left_garage' || t.status === 'departed' || t.status === 'left_warehouse').length;
  const arrivedDepotCount = trips.filter(t => t.status === 'arrived_at_depot' || t.status === 'arrived_at_supplier').length;
  const loadedHighwayCount = trips.filter(t => t.status === 'loaded_departed' || t.status === 'cargo_loaded').length;
  const atDestCount = trips.filter(t => t.status === 'arrived_at_destination').length;
  const completedTripsCount = trips.filter(t => t.status === 'completed' || t.status === 'arrived_offloaded' || !!t.completed_at).length;

  return (
    <div className="space-y-6">
      {/* DRIVER INTERFERENCE REAL-TIME ALERTS */}
      {token && <FleetInterferenceAlertBanner token={token} userRole={user?.role} />}

      {/* HEADER METRICS BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-xl">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white tracking-tight">Live 5-Checkpoint Fleet Board 🚚</h2>
                <span className="inline-flex items-center space-x-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time tracking from Garage departure to Depot loading, Destination arrival &amp; Offloading completion
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

        {/* SUMMARY STAT CARDS (5 Stages) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">1. Left Garage</p>
            <p className="text-xl font-black text-white mt-1">{leftGarageCount}</p>
            <span className="text-[10px] text-slate-400">Heading to Depot</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">2. At Depot</p>
            <p className="text-xl font-black text-purple-300 mt-1">{arrivedDepotCount}</p>
            <span className="text-[10px] text-slate-400">Awaiting cargo load</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">3. Loaded On Road</p>
            <p className="text-xl font-black text-blue-300 mt-1">{loadedHighwayCount}</p>
            <span className="text-[10px] text-slate-400">En route to Dest</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">4. At Destination</p>
            <p className="text-xl font-black text-indigo-300 mt-1">{atDestCount}</p>
            <span className="text-[10px] text-slate-400">Arrived at gate</span>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">5. Completed</p>
            <p className="text-xl font-black text-emerald-300 mt-1">{completedTripsCount}</p>
            <span className="text-[10px] text-slate-400">Offloaded &amp; Done</span>
          </div>
        </div>
      </div>

      {/* CONTROLS BAR: SEARCH & STAGE FILTERS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by truck plate, driver name, phone, or destination..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Active Trips ({trips.length - completedTripsCount})
          </button>
          <button
            onClick={() => setStatusFilter('left_garage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'left_garage'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stage 1: Left Garage
          </button>
          <button
            onClick={() => setStatusFilter('arrived_at_depot')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'arrived_at_depot'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stage 2: At Depot
          </button>
          <button
            onClick={() => setStatusFilter('loaded_departed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'loaded_departed'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stage 3: Loaded
          </button>
          <button
            onClick={() => setStatusFilter('arrived_at_destination')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'arrived_at_destination'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stage 4: At Destination
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stage 5: Completed ({completedTripsCount})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({trips.length})
          </button>
        </div>
      </div>

      {/* TRIPS LIST */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading live fleet records...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Truck className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Trips Found in This Category</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No fleet trips matched "${searchQuery}". Try a different search.`
              : 'There are no trips currently in this stage.'}
          </p>
          {onNewTripClick && (
            <button
              onClick={onNewTripClick}
              className="mt-2 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Start New Trip
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map((trip) => {
            const driver = getDriverForTruck(trip.truck_id) || (trip.driver_id ? drivers.find(d => d.id === trip.driver_id) : null) || {
              id: trip.driver_id || 'drv',
              name: trip.driver_name || 'Assigned Driver',
              phone_number: trip.driver_phone || ''
            };

            return (
              <FleetTripCard
                key={trip.id}
                trip={trip as any}
                driver={driver}
                onSelect={(t) => setSelectedTrip(t as any)}
                onPayTrip={onPayTrip}
              />
            );
          })}
        </div>
      )}

      {/* TIMELINE MODAL */}
      {selectedTrip && (
        <FleetTripTimelineModal
          trip={selectedTrip}
          driver={getDriverForTruck(selectedTrip.truck_id) || (selectedTrip.driver_id ? drivers.find(d => d.id === selectedTrip.driver_id) : null) || {
            id: selectedTrip.driver_id || 'drv',
            name: selectedTrip.driver_name || 'Assigned Driver',
            phone_number: selectedTrip.driver_phone || ''
          }}
          userRole={(user?.role as any) || 'company'}
          onClose={() => setSelectedTrip(null)}
          onPayTrip={onPayTrip}
          onTripUpdated={fetchData}
        />
      )}
    </div>
  );
};

export default RealtimeFleetBoard;
