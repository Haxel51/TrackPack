import React from 'react';
import {
  X,
  Truck,
  Building2,
  MapPin,
  Calendar,
  Clock,
  User,
  Phone,
  MessageSquare,
  FileText,
  CheckCircle2,
  Activity,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { FleetTripCardData, DriverInfo, getFleetStatusBadgeStyle, getFleetStatusLabel } from './FleetTripCard';
import { getFleetTripNarrative } from '../../lib/fleetNarrative';

interface FleetTripTimelineModalProps {
  trip: FleetTripCardData | null;
  driver?: DriverInfo | null;
  onClose: () => void;
  onPayTrip?: (tripId: string) => void;
}

export const FleetTripTimelineModal: React.FC<FleetTripTimelineModalProps> = ({
  trip,
  driver,
  onClose,
  onPayTrip
}) => {
  if (!trip) return null;

  const narrativeInfo = getFleetTripNarrative(trip);

  const isCompleted = trip.status === 'completed' || trip.status === 'arrived_offloaded';
  const isAtDepotGate = trip.status === 'arrived_at_destination';
  const isLoadedDeparted = trip.status === 'loaded_departed';
  const isCargoLoaded = trip.status === 'cargo_loaded';
  const isArrivedSupplier = trip.status === 'arrived_at_supplier';
  const isLeftWarehouse = trip.status === 'left_warehouse';

  const currentStageNum = isCompleted
    ? 7
    : isAtDepotGate
    ? 6
    : isLoadedDeparted
    ? 5
    : isCargoLoaded
    ? 4
    : isArrivedSupplier
    ? 3
    : isLeftWarehouse
    ? 2
    : 1;

  const progressPct = Math.round((currentStageNum / 7) * 100);

  const formattedCreated = new Date(trip.created_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const originName = trip.origin_park || 'Origin Depot';
  const supplierName = trip.supplier_name || 'Supplier Plant';

  const whatsappUrl = driver?.phone_number
    ? `https://wa.me/234${driver.phone_number.replace(/^0+/, '')}?text=Hello%20${encodeURIComponent(
        driver.name
      )},%20checking%20status%20on%20Truck%20${encodeURIComponent(
        trip.truck_number
      )}%20trip%20to%20${encodeURIComponent(supplierName)}.`
    : null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto relative animate-scaleUp border border-slate-100 flex flex-col">
        {/* MODAL HEADER */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 p-5 rounded-t-3xl flex items-start justify-between gap-3 z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-[#0A1F44] uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xs">
                <Truck className="w-4 h-4 text-[#F2A93B]" />
                {trip.truck_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getFleetStatusBadgeStyle(
                  trip.status
                )}`}
              >
                {getFleetStatusLabel(trip.status)}
              </span>
            </div>
            <h2 className="text-lg font-black text-[#0A1F44] pt-1 leading-snug">
              {supplierName} Haulage Trip
            </h2>
            <p className="text-xs text-slate-400">
              Booked on {formattedCreated}
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* OVERDUE ALERT IF ACTIVE */}
          {narrativeInfo.isOverdue && narrativeInfo.overdueWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-black uppercase tracking-wider text-amber-900 block">
                  Overdue Checkpoint Warning
                </span>
                <p className="font-medium text-amber-800 leading-relaxed">
                  {narrativeInfo.overdueWarning}
                </p>
              </div>
            </div>
          )}

          {/* DRIVER INFO & 1-TAP CONTACT BAR */}
          {driver && (
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Driver</p>
                  <p className="text-sm font-black text-slate-900">{driver.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{driver.phone_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 sm:pt-0">
                <a
                  href={`tel:${driver.phone_number}`}
                  className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Driver</span>
                </a>

                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ORIGIN ➔ DESTINATION ROUTE HEADER */}
          <div className="bg-[#FAFAFA] border border-slate-200 rounded-2xl p-4 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Origin Depot
              </span>
              <span className="font-extrabold text-slate-800 text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {originName}
              </span>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-300 shrink-0" />

            <div className="space-y-0.5 text-right">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Destination Supplier
              </span>
              <span className="font-extrabold text-slate-800 text-sm flex items-center justify-end gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#F2A93B]" />
                {supplierName}
              </span>
            </div>
          </div>

          {/* LIVE JOURNEY PROGRESS BAR */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[#0A1F44]">Journey Progress</span>
              <span className="text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Stage {currentStageNum} of 7 ({progressPct}%)
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 via-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200/60 text-xs">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">
                Current Status Narrative
              </span>
              <p className="font-bold text-slate-800 italic">
                "{narrativeInfo.narrative}"
              </p>
            </div>
          </div>

          {/* 7-STAGE COMPLETE VERTICAL TIMELINE */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Complete 7-Stage Audit Timeline
            </h4>

            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-5">
              {/* STAGE 1: Booked & Assigned */}
              <div className="relative">
                <span className="absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white border-emerald-500 text-emerald-600 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-extrabold text-slate-900">
                      1. Trip Booked & Assigned (Management)
                    </h5>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {new Date(trip.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Truck {trip.truck_number} assigned for haulage to {supplierName}.
                  </p>
                </div>
              </div>

              {/* STAGE 2: Departed Origin Depot */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    trip.left_warehouse_at
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        trip.left_warehouse_at ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      2. Departed Origin Depot (Outbound Gate)
                    </h5>
                    {trip.left_warehouse_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.left_warehouse_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trip.left_warehouse_at
                      ? `Gate clearance confirmed by Depot Staff ${trip.left_warehouse_by ? `(${trip.left_warehouse_by})` : ''}.`
                      : 'Awaiting departure clearance by Depot Gate Staff.'}
                  </p>
                </div>
              </div>

              {/* STAGE 3: Arrived at Supplier Plant */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    trip.arrived_at_supplier_at
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isLeftWarehouse
                      ? 'border-blue-500 text-blue-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        trip.arrived_at_supplier_at ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      3. Arrived at Supplier Plant Gate
                    </h5>
                    {trip.arrived_at_supplier_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.arrived_at_supplier_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trip.arrived_at_supplier_at
                      ? `Inbound gate check-in confirmed by ${supplierName} Staff.`
                      : `Awaiting check-in at ${supplierName} plant gate.`}
                  </p>
                </div>
              </div>

              {/* STAGE 4: Cargo Loaded & Sealed */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    trip.cargo_loaded_at
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isArrivedSupplier
                      ? 'border-purple-500 text-purple-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        trip.cargo_loaded_at ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      4. Cargo Loaded & Waybill Attached
                    </h5>
                    {trip.cargo_loaded_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.cargo_loaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trip.cargo_loaded_at
                      ? `Loaded at ${supplierName}${trip.waybill_number ? ` • Waybill #${trip.waybill_number}` : ''}${
                          trip.cargo_notes ? ` • "${trip.cargo_notes}"` : ''
                        }.`
                      : `Awaiting loading bay clearance by ${supplierName}.`}
                  </p>
                </div>
              </div>

              {/* STAGE 5: Dispatched from Plant */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    trip.loaded_departed_at
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isCargoLoaded
                      ? 'border-amber-500 text-amber-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        trip.loaded_departed_at ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      5. Dispatched from Plant (Inbound Transit)
                    </h5>
                    {trip.loaded_departed_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.loaded_departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trip.loaded_departed_at
                      ? `Exit clearance authorized by ${supplierName}. In-transit return.`
                      : `Awaiting plant exit clearance.`}
                  </p>
                </div>
              </div>

              {/* STAGE 6: Arrived at Destination Depot */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    trip.arrived_at_destination_at
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isLoadedDeparted
                      ? 'border-blue-500 text-blue-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        trip.arrived_at_destination_at ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      6. Arrived at Destination Depot Gate
                    </h5>
                    {trip.arrived_at_destination_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.arrived_at_destination_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {trip.arrived_at_destination_at
                      ? 'Gate arrival verified by Depot Staff. Queued for offloading.'
                      : 'Awaiting return arrival at destination depot.'}
                  </p>
                </div>
              </div>

              {/* STAGE 7: Completed & Offloaded */}
              <div className="relative">
                <span
                  className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    isCompleted
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isAtDepotGate
                      ? 'border-emerald-500 text-emerald-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        isCompleted ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      7. Offloaded & Trip Completed
                    </h5>
                    {trip.arrived_offloaded_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        {new Date(trip.arrived_offloaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {isCompleted
                      ? `Cargo safely received and trip finalized by Depot Staff.`
                      : 'Awaiting offloading verification.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BILLING & PAYMENT STATUS */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Billing Method
              </span>
              <p className="font-extrabold text-slate-800 text-sm">
                {trip.billing_method === 'monthly' ? 'Monthly Fleet Subscription' : 'Per-Trip Haulage Fee'}
              </p>
              {trip.trip_fee !== undefined && (
                <p className="text-slate-500 mt-0.5">
                  Amount: <strong>₦{trip.trip_fee.toLocaleString()}</strong>
                </p>
              )}
            </div>

            {trip.payment_status === 'pending' && (trip.trip_fee || 0) > 0 && onPayTrip ? (
              <button
                onClick={() => onPayTrip(trip.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay ₦{trip.trip_fee}</span>
              </button>
            ) : (
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-extrabold text-xs">
                {trip.payment_status === 'active_monthly' ? 'ACTIVE SUBSCRIPTION' : 'PAID & SETTLED'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
