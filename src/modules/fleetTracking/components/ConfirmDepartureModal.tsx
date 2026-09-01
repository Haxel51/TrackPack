import React from 'react';
import { TripRecord } from '../types';
import { Truck, MapPin, Phone, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmDepartureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeparture: () => Promise<void> | void;
  trip: TripRecord | null;
  isLoading?: boolean;
}

export const ConfirmDepartureModal: React.FC<ConfirmDepartureModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeparture,
  trip,
  isLoading = false,
}) => {
  if (!isOpen || !trip) return null;

  const destinationName = trip.redirect_destination?.name || trip.primary_destination_name || 'Primary Destination';
  const isPaymentConfirmed = trip.payment_status === 'confirmed' || trip.tracking_active === true;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#070b19]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
      id="confirm-departure-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="bg-[#0b1329] border border-blue-950/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp"
        id="confirm-departure-dialog"
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-white" id="confirm-departure-title">
              Confirm Truck Departure
            </h3>
            <p className="text-xs text-slate-400">
              Please verify that this truck has departed from the garage.
            </p>
          </div>
        </div>

        {/* Trip Details Card */}
        <div className="bg-[#070b19]/80 p-4 rounded-2xl border border-blue-950/60/80 space-y-3">
          {/* Plate Number & Driver */}
          <div className="flex items-center justify-between border-b border-blue-950/60 pb-2.5">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Truck Plate Number
              </span>
              <div className="text-sm font-black text-amber-400" id="departure-plate-number">
                {trip.plate_number}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Driver Name
              </span>
              <div className="text-xs font-bold text-white" id="departure-driver-name">
                {trip.driver_name}
              </div>
              {trip.driver_phone && (
                <div className="text-[11px] text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-500" />
                  <span>{trip.driver_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="flex items-start gap-2 pt-1 text-xs">
            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wider">
                Destination
              </span>
              <div className="font-extrabold text-white text-xs" id="departure-destination-name">
                {destinationName}
              </div>
            </div>
          </div>

          {/* Payment Status Notice */}
          {!isPaymentConfirmed && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 rounded-xl flex items-start gap-2 text-amber-300 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Payment of ₦{trip.payment_amount.toLocaleString()} is pending. Confirming departure will request payment verification.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons: Yes, Truck Has Left (Green) & Not Yet (Grey) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Grey button: Not Yet */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="w-full sm:w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 border border-blue-900/65 transition-colors cursor-pointer"
            id="departure-not-yet-btn"
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>❌ Not Yet</span>
          </button>

          {/* Green button: Yes, Truck Has Left */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirmDeparture}
            className="w-full sm:w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            id="departure-confirm-yes-btn"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-white stroke-[3]" />
            )}
            <span>✅ Yes, Truck Has Left</span>
          </button>
        </div>
      </div>
    </div>
  );
};
