import React from 'react';
import {
  Truck,
  Building2,
  MapPin,
  Calendar,
  ChevronRight,
  User,
  Phone,
  Clock,
  AlertTriangle,
  ArrowRight,
  FileText,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { getFleetTripNarrative } from '../../lib/fleetNarrative';

export interface FleetTripCardData {
  id: string;
  truck_id: string;
  truck_number: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  billing_method: 'per_trip' | 'monthly' | string;
  trip_fee?: number;
  payment_status?: string;
  left_warehouse_at?: string | null;
  left_warehouse_by?: string | null;
  departed_at?: string | null;
  departed_by?: string | null;
  arrived_at_supplier_at?: string | null;
  arrived_at_supplier_by?: string | null;
  cargo_loaded_at?: string | null;
  cargo_loaded_by?: string | null;
  loaded_departed_at?: string | null;
  loaded_departed_by?: string | null;
  arrived_at_destination_at?: string | null;
  arrived_at_destination_by?: string | null;
  completed_at?: string | null;
  arrived_offloaded_at?: string | null;
  arrived_offloaded_by?: string | null;
  waybill_number?: string | null;
  cargo_notes?: string | null;
  origin_park?: string | null;
  created_at: string;
  expected_duration_minutes?: number;
  route_osrm?: {
    leg1_minutes?: number;
    leg2_minutes?: number;
    distance_km?: number;
    total_minutes?: number;
  };
  self_learned_eta?: {
    display?: string;
    sample_size?: number;
    is_learned?: boolean;
  };
  audit_notes?: string[];
  location_shares?: Array<{ timestamp: string; note: string; source?: string }>;
}

export interface DriverInfo {
  id: string;
  name: string;
  phone_number: string;
}

interface FleetTripCardProps {
  trip: FleetTripCardData;
  driver?: DriverInfo | null;
  onSelect: (trip: FleetTripCardData) => void;
  onPayTrip?: (tripId: string) => void;
  id?: string;
}

export function getFleetStatusBadgeStyle(status: string) {
  switch (status) {
    case 'completed':
    case 'arrived_offloaded':
    case 'offloaded_completed':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'arrived_at_destination':
      return 'bg-blue-50 text-blue-900 border-blue-300';
    case 'loaded_departed':
      return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'arrived_at_depot':
    case 'arrived_at_supplier':
    case 'cargo_loaded':
      return 'bg-purple-50 text-purple-900 border-purple-200';
    case 'left_garage':
    case 'departed':
    case 'left_warehouse':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'pending_payment':
    case 'created':
    case 'initiated':
    case 'trip_created':
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function getFleetStatusLabel(status: string) {
  switch (status) {
    case 'completed':
    case 'arrived_offloaded':
    case 'offloaded_completed':
      return 'OFFLOADED & COMPLETED 🎉';
    case 'arrived_at_destination':
      return 'ARRIVED AT DESTINATION 🏢';
    case 'loaded_departed':
      return 'LOADED & DEPARTED 🚚💨';
    case 'arrived_at_depot':
    case 'arrived_at_supplier':
    case 'cargo_loaded':
      return 'ARRIVED AT DEPOT 🏭';
    case 'left_garage':
    case 'departed':
    case 'left_warehouse':
      return 'LEFT GARAGE 🛣️';
    case 'pending_payment':
      return 'AWAITING PAYMENT 💳';
    case 'created':
    case 'initiated':
    case 'trip_created':
    default:
      return 'TRIP BOOKED 📋';
  }
}

export const FleetTripCard: React.FC<FleetTripCardProps> = ({
  trip,
  driver,
  onSelect,
  onPayTrip,
  id
}) => {
  const narrativeInfo = getFleetTripNarrative(trip);

  const formattedDate = new Date(trip.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const originName = trip.origin_park || 'Loading Park';
  const destinationName = trip.supplier_name || 'Destination Factory';

  return (
    <div
      id={id}
      onClick={() => onSelect(trip)}
      className="bg-white border border-slate-200/90 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-md hover:shadow-xl transition-all cursor-pointer flex items-center justify-between group"
    >
      <div className="space-y-2.5 flex-grow min-w-0 pr-3 sm:pr-4">
        {/* Top Line: Truck Plate Tag, Mode, Driver info, Overdue warning */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="font-black text-xs sm:text-sm text-[#0A1F44] uppercase tracking-wider bg-slate-100 px-2.5 py-0.5 rounded flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#F2A93B]" />
            {trip.truck_number}
          </span>

          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider border bg-amber-50 text-amber-800 border-amber-200">
            {trip.billing_method === 'monthly' ? 'MONTHLY TRUCK' : 'PAY-PER-TRIP'}
          </span>

          {driver && (
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <User className="w-3 h-3 text-indigo-500" />
              Driver: {driver.name}
            </span>
          )}

          {trip.waybill_number && (
            <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
              <FileText className="w-3 h-3 text-purple-500" />
              Waybill #{trip.waybill_number}
            </span>
          )}

          {narrativeInfo.isOverdue && (
            <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              DELAYED ON ROAD
            </span>
          )}
        </div>

        {/* Middle Line: Destination */}
        <div>
          <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug truncate group-hover:text-blue-900 transition-colors">
            Trip to {destinationName}
            {trip.cargo_notes ? ` • ${trip.cargo_notes}` : ''}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
            {narrativeInfo.narrative}
          </p>
        </div>

        {/* Bottom Line: Route, Date, Status Pill */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1 text-slate-700 font-bold text-[11px] sm:text-xs">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none">{originName}</span>
            <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-none text-[#0A1F44]">{destinationName}</span>
          </span>

          <span className="flex items-center gap-1 text-slate-500 text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-slate-300" />
            {formattedDate}
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${getFleetStatusBadgeStyle(
              trip.status
            )}`}
          >
            {getFleetStatusLabel(trip.status)}
          </span>

          {trip.payment_status === 'pending' && (trip.trip_fee || 0) > 0 && onPayTrip && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPayTrip(trip.id);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-xs transition-colors cursor-pointer"
            >
              Pay ₦{trip.trip_fee}
            </button>
          )}
        </div>
      </div>

      {/* Right Chevron indicating 1-Tap Detailed Tracker */}
      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#F2A93B] group-hover:translate-x-1 transition-all flex-shrink-0" />
    </div>
  );
};
