import React, { useState } from 'react';
import {
  X,
  Truck,
  Building2,
  MapPin,
  Clock,
  User,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Edit3
} from 'lucide-react';
import { FleetTripCardData, DriverInfo } from './FleetTripCard';
import { getFleetTripNarrative } from '../../lib/fleetNarrative';
import { useAuth } from '../../context/AuthContext';
import { advanceTripCheckpoint, changeFleetTripDestination } from '../../lib/api';
import { LiveTruckMapModal } from './LiveTruckMapModal';
import { LocationPickerModal } from './LocationPickerModal';

interface FleetTripTimelineModalProps {
  trip: FleetTripCardData | any | null;
  driver?: DriverInfo | null;
  userRole?: 'company' | 'manager' | 'staff' | 'supplier_staff';
  onClose: () => void;
  onPayTrip?: (tripId: string) => void;
  onTripUpdated?: () => void;
}

export const FleetTripTimelineModal: React.FC<FleetTripTimelineModalProps> = ({
  trip,
  driver,
  userRole = 'company',
  onClose,
  onPayTrip,
  onTripUpdated
}) => {
  const { token } = useAuth();
  const [showMapModal, setShowMapModal] = useState(false);
  const [showChangeDestModal, setShowChangeDestModal] = useState(false);
  const [submittingCheckpoint, setSubmittingCheckpoint] = useState<string | null>(null);
  const [changingDest, setChangingDest] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!trip) return null;

  const narrativeInfo = getFleetTripNarrative(trip);

  // 5-Stage Status Tracking
  const isCompleted = trip.status === 'completed' || trip.status === 'arrived_offloaded' || !!trip.completed_at || !!trip.arrived_offloaded_at;
  const isArrivedAtDestination = isCompleted || trip.status === 'arrived_at_destination' || !!trip.arrived_at_destination_at;
  const isLoadedDeparted = isArrivedAtDestination || trip.status === 'loaded_departed' || trip.status === 'cargo_loaded' || !!trip.loaded_departed_at;
  const isArrivedAtDepot = isLoadedDeparted || trip.status === 'arrived_at_depot' || trip.status === 'arrived_at_supplier' || !!trip.arrived_at_supplier_at;
  const isLeftGarage = isArrivedAtDepot || trip.status === 'left_garage' || trip.status === 'departed' || trip.status === 'left_warehouse' || trip.status === 'initiated' || !!trip.departed_at || !!trip.left_warehouse_at;

  const currentStageNum = isCompleted ? 5 : isArrivedAtDestination ? 4 : isLoadedDeparted ? 3 : isArrivedAtDepot ? 2 : 1;
  const progressPct = isCompleted ? 100 : isArrivedAtDestination ? 80 : isLoadedDeparted ? 60 : isArrivedAtDepot ? 40 : 20;

  const garageName = trip.origin_park || trip.origin_name || 'Origin Garage';
  const depotName = trip.depot_name || trip.supplier_name || 'Supplier Depot';
  const destinationName = trip.supplier_name || 'Destination Factory';

  const formattedCreated = new Date(trip.created_at).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const whatsappUrl = driver?.phone_number
    ? `https://wa.me/234${driver.phone_number.replace(/^0+/, '')}?text=Hello%20${encodeURIComponent(
        driver.name
      )},%20checking%20status%20on%20Truck%20${encodeURIComponent(
        trip.truck_number
      )}%20trip%20to%20${encodeURIComponent(destinationName)}.`
    : null;

  const isCompanyOrManagerOrStaff = userRole === 'company' || userRole === 'manager' || userRole === 'staff';
  const isSupplierStaff = userRole === 'supplier_staff';

  const canChangeDestination = (userRole === 'company' || userRole === 'manager') && !isCompleted;

  // Permissions for 5 checkpoints
  // 1. Left Garage: CEO / Manager / Staff
  const canAdvanceStage1 = isCompanyOrManagerOrStaff && !isLeftGarage;
  // 2. Arrived at Depot: Supplier / Depot Staff ONLY
  const canAdvanceStage2 = isSupplierStaff && isLeftGarage && !isArrivedAtDepot;
  // 3. Loaded & Departed: Supplier / Depot Staff ONLY
  const canAdvanceStage3 = isSupplierStaff && isArrivedAtDepot && !isLoadedDeparted;
  // 4. Arrived at Destination: CEO / Manager / Staff
  const canAdvanceStage4 = isCompanyOrManagerOrStaff && isLoadedDeparted && !isArrivedAtDestination;
  // 5. Offloaded & Completed: CEO / Manager / Staff
  const canAdvanceStage5 = isCompanyOrManagerOrStaff && isArrivedAtDestination && !isCompleted;

  const handleCheckpointAdvance = async (checkpoint: string, friendlyLabel: string) => {
    if (!token) return;
    setSubmittingCheckpoint(checkpoint);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await advanceTripCheckpoint(token, trip.id, checkpoint);
      if (!res.success) {
        throw new Error(res.error || 'Failed to update checkpoint');
      }
      setActionSuccess(`${friendlyLabel} recorded successfully!`);
      if (onTripUpdated) onTripUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Error advancing checkpoint');
    } finally {
      setSubmittingCheckpoint(null);
    }
  };

  const handleDestinationSelected = async (loc: { name: string; latitude: number; longitude: number; formatted_address: string }) => {
    if (!token) return;
    setChangingDest(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const targetName = loc.name || loc.formatted_address;
      const res = await changeFleetTripDestination(token, trip.id, {
        destination_name: targetName,
        latitude: loc.latitude,
        longitude: loc.longitude
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to update destination');
      }

      setActionSuccess(`Destination successfully changed to ${targetName}! OSRM ETA recalculated.`);
      setShowChangeDestModal(false);
      if (onTripUpdated) onTripUpdated();
    } catch (err: any) {
      setActionError(err.message || 'Could not change destination');
    } finally {
      setChangingDest(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-xl w-full h-[94vh] sm:h-auto sm:max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
        
        {/* MODAL HEADER */}
        <div className="shrink-0 bg-white border-b border-slate-100 p-4 sm:p-5 flex items-start justify-between gap-3 z-10">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-xs text-[#0A1F44] uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-xl flex items-center gap-1.5 shadow-xs shrink-0">
                <Truck className="w-3.5 h-3.5 text-[#F2A93B]" />
                {trip.truck_number}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isArrivedAtDestination
                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                    : isLoadedDeparted
                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                    : isArrivedAtDepot
                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {narrativeInfo.stageBadgeText}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-[#0A1F44] truncate leading-snug">
              {destinationName} Round Trip
            </h2>
            <p className="text-[11px] text-slate-400">
              Trip started on {formattedCreated}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2.5 rounded-full transition-all cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (Full Smooth Scroll) */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto overscroll-contain pb-24 sm:pb-8">
          
          {/* Action Alerts */}
          {actionError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-3.5 text-xs font-semibold">
              {actionError}
            </div>
          )}
          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3.5 text-xs font-semibold">
              {actionSuccess}
            </div>
          )}

          {/* ACTIVE NARRATIVE CARD */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-2 border border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-amber-400" />
                Live Status Breakdown
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 font-mono px-2 py-0.5 rounded-md">
                Checkpoint {currentStageNum} of 5
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white leading-snug">
              {narrativeInfo.headline}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {narrativeInfo.narrative}
            </p>
          </div>

          {/* OVERDUE ALERT IF ACTIVE */}
          {narrativeInfo.isOverdue && narrativeInfo.overdueWarning && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 text-amber-950 text-xs flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
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
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Assigned Driver</p>
                  <p className="text-sm font-black text-slate-900 truncate">{driver.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{driver.phone_number}</p>
                </div>
              </div>

              {/* 3 Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {!isCompleted ? (
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 shadow-xs transition-all cursor-pointer min-h-[42px]"
                    title="Check driver live GPS location"
                  >
                    <MapPin className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                    <span className="truncate">Check GPS</span>
                  </button>
                ) : (
                  <div className="bg-slate-200 text-slate-500 text-xs font-bold py-2.5 px-2 rounded-xl flex items-center justify-center min-h-[42px]">
                    Trip Done
                  </div>
                )}

                <a
                  href={`tel:${driver.phone_number}`}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold text-xs py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Call</span>
                </a>

                {whatsappUrl ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs py-2.5 px-2 rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[42px]"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">WhatsApp</span>
                  </a>
                ) : (
                  <div className="bg-slate-200 text-slate-400 text-xs font-bold py-2.5 px-2 rounded-xl flex items-center justify-center min-h-[42px]">
                    No WA
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ORIGIN ➔ DESTINATION ROUTE & CHANGE DESTINATION */}
          <div className="bg-[#FAFAFA] border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Origin Garage
                </span>
                <span className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{garageName}</span>
                </span>
              </div>

              <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

              <div className="space-y-0.5 text-right min-w-0">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  Destination
                </span>
                <span className="font-extrabold text-slate-800 text-xs sm:text-sm flex items-center justify-end gap-1 truncate">
                  <Building2 className="w-3.5 h-3.5 text-[#F2A93B] shrink-0" />
                  <span className="truncate">{destinationName}</span>
                </span>
              </div>
            </div>

            {/* Mid-Trip Destination Change Control */}
            {canChangeDestination && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-500 truncate">Redirect truck mid-trip?</p>
                <button
                  type="button"
                  onClick={() => setShowChangeDestModal(true)}
                  disabled={changingDest}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-extrabold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Change Destination</span>
                </button>
              </div>
            )}
          </div>

          {/* LIVE JOURNEY PROGRESS BAR */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span className="text-[#0A1F44]">5-Checkpoint Progress</span>
              <span className="text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px]">
                Checkpoint {currentStageNum} of 5 ({progressPct}%)
              </span>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 via-purple-600 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* ETA Info if available */}
            {trip.self_learned_eta?.display && (
              <div className="p-3 bg-white rounded-xl border border-slate-200/60 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    Dynamic Route ETA
                  </span>
                  <p className="font-bold text-slate-800 truncate">
                    {trip.self_learned_eta.display}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 5-CHECKPOINT TIMELINE AUDIT TRAIL */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              5-Checkpoint Journey Timeline
            </h4>

            <div className="relative border-l-2 border-slate-200 ml-4 pl-5 space-y-6">
              
              {/* CHECKPOINT 1: Left Garage */}
              <div className="relative">
                <span className={`absolute -left-[27px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                  isLeftGarage ? 'border-emerald-500 text-emerald-600 shadow-xs' : 'border-slate-300 text-slate-300'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-extrabold text-slate-900">
                      1. Left Garage
                    </h5>
                    {(trip.departed_at || trip.left_warehouse_at || trip.created_at) && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {new Date(trip.departed_at || trip.left_warehouse_at || trip.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Truck {trip.truck_number} has departed from {garageName} and is heading to {depotName}. Trip started and GPS clock activated.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      Managed by: CEO / Manager / Staff
                    </span>
                  </div>

                  {canAdvanceStage1 && (
                    <button
                      type="button"
                      disabled={!!submittingCheckpoint}
                      onClick={() => handleCheckpointAdvance('left_garage', 'Checkpoint 1 (Left Garage)')}
                      className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {submittingCheckpoint === 'left_garage' ? (
                        <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tap Checkpoint 1: Mark Left Garage</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* CHECKPOINT 2: Arrived at Depot */}
              <div className="relative">
                <span
                  className={`absolute -left-[27px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    isArrivedAtDepot
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isLeftGarage
                      ? 'border-purple-500 text-purple-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        isArrivedAtDepot ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      2. Arrived at Depot
                    </h5>
                    {trip.arrived_at_supplier_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {new Date(trip.arrived_at_supplier_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Truck {trip.truck_number} has arrived at {depotName} and is waiting to be loaded.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold">
                      🔒 Strictly Supplier / Depot Staff only
                    </span>
                  </div>

                  {canAdvanceStage2 && (
                    <button
                      type="button"
                      disabled={!!submittingCheckpoint}
                      onClick={() => handleCheckpointAdvance('arrived_at_depot', 'Checkpoint 2 (Arrived at Depot)')}
                      className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {submittingCheckpoint === 'arrived_at_depot' ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tap Checkpoint 2: Mark Arrived at Depot</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* CHECKPOINT 3: Loaded & Departed */}
              <div className="relative">
                <span
                  className={`absolute -left-[27px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    isLoadedDeparted
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isArrivedAtDepot
                      ? 'border-blue-500 text-blue-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        isLoadedDeparted ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      3. Loaded &amp; Departed
                    </h5>
                    {(trip.loaded_departed_at || trip.cargo_loaded_at) && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {new Date(trip.loaded_departed_at || trip.cargo_loaded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Truck {trip.truck_number} has been loaded at {depotName} and is now heading to {destinationName}.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold">
                      🔒 Strictly Supplier / Depot Staff only
                    </span>
                    {trip.waybill_number && (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                        Waybill #{trip.waybill_number}
                      </span>
                    )}
                  </div>

                  {canAdvanceStage3 && (
                    <button
                      type="button"
                      disabled={!!submittingCheckpoint}
                      onClick={() => handleCheckpointAdvance('loaded_departed', 'Checkpoint 3 (Loaded & Departed)')}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {submittingCheckpoint === 'loaded_departed' ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tap Checkpoint 3: Mark Loaded &amp; Departed</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* CHECKPOINT 4: Arrived at [Destination Name] */}
              <div className="relative">
                <span
                  className={`absolute -left-[27px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    isArrivedAtDestination
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isLoadedDeparted
                      ? 'border-blue-500 text-blue-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        isArrivedAtDestination ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      4. Arrived at {destinationName}
                    </h5>
                    {trip.arrived_at_destination_at && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {new Date(trip.arrived_at_destination_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Truck {trip.truck_number} has arrived at {destinationName}.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      Managed by: CEO / Manager / Staff
                    </span>
                  </div>

                  {canAdvanceStage4 && (
                    <button
                      type="button"
                      disabled={!!submittingCheckpoint}
                      onClick={() => handleCheckpointAdvance('arrived_at_destination', `Checkpoint 4 (Arrived at ${destinationName})`)}
                      className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      {submittingCheckpoint === 'arrived_at_destination' ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tap Checkpoint 4: Arrived at {destinationName}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* CHECKPOINT 5: Offloaded & Completed */}
              <div className="relative">
                <span
                  className={`absolute -left-[27px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white ${
                    isCompleted
                      ? 'border-emerald-500 text-emerald-600 shadow-xs'
                      : isArrivedAtDestination
                      ? 'border-emerald-500 text-emerald-600 animate-pulse'
                      : 'border-slate-300 text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 fill-current" />
                </span>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h5
                      className={`text-xs font-extrabold ${
                        isCompleted ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      5. Offloaded &amp; Completed
                    </h5>
                    {(trip.completed_at || trip.arrived_offloaded_at) && (
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        {new Date(trip.completed_at || trip.arrived_offloaded_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Truck {trip.truck_number} has been offloaded successfully. Trip completed and driver GPS tracking permanently deactivated.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                      Managed by: CEO / Manager / Staff
                    </span>
                  </div>

                  {canAdvanceStage5 && (
                    <button
                      type="button"
                      disabled={!!submittingCheckpoint}
                      onClick={() => handleCheckpointAdvance('offloaded_completed', 'Checkpoint 5 (Offloaded & Completed)')}
                      className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                    >
                      {submittingCheckpoint === 'offloaded_completed' ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Tap Checkpoint 5: Offload &amp; Complete Trip</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Audit History Notes (including Destination changes with clean formatted time) */}
          {trip.audit_notes && trip.audit_notes.length > 0 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Trip Audit Logs
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {trip.audit_notes.map((log: string, idx: number) => (
                  <div key={idx} className="text-xs text-slate-700 bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BILLING & PAYMENT STATUS */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                Billing Method
              </span>
              <p className="font-extrabold text-slate-800 text-xs sm:text-sm">
                {trip.billing_method === 'monthly' ? 'Monthly Fleet Subscription' : 'Per-Trip Haulage Fee'}
              </p>
            </div>

            {trip.payment_status === 'pending' && (trip.trip_fee || 0) > 0 && onPayTrip ? (
              <button
                type="button"
                onClick={() => onPayTrip(trip.id)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay ₦{trip.trip_fee}</span>
              </button>
            ) : (
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-extrabold text-[11px]">
                {trip.payment_status === 'active_monthly' ? 'ACTIVE SUBSCRIPTION' : 'PAID & SETTLED'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Map Modal */}
      {showMapModal && token && (
        <LiveTruckMapModal
          token={token}
          truckId={trip.truck_id}
          truckNumber={trip.truck_number}
          onClose={() => setShowMapModal(false)}
        />
      )}

      {/* Location Picker for Mid-Trip Destination Change */}
      {showChangeDestModal && (
        <LocationPickerModal
          title="Change Trip Destination"
          initialQuery={destinationName}
          onConfirm={handleDestinationSelected}
          onClose={() => setShowChangeDestModal(false)}
        />
      )}
    </div>
  );
};

export default FleetTripTimelineModal;
