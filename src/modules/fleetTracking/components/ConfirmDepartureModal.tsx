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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn"
      id="confirm-departure-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp"
        id="confirm-departure-dialog"
      >
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900" id="confirm-departure-title">
              Confirm Vehicle Departure
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Please verify that this asset has departed from the terminal/hub.
            </p>
          </div>
        </div>

        {/* Trip Details Card */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          {/* Plate Number & Driver */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div>
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Asset Plate Number
              </span>
              <div className="text-sm font-black text-orange-600" id="departure-plate-number">
                {trip.plate_number}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Driver Name
              </span>
              <div className="text-xs font-bold text-slate-900" id="departure-driver-name">
                {trip.driver_name}
              </div>
              {trip.driver_phone && (
                <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1 mt-0.5 font-medium">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{trip.driver_phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Destination */}
          <div className="flex items-start gap-2 pt-1 text-xs">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                Destination
              </span>
              <div className="font-extrabold text-slate-900 text-xs" id="departure-destination-name">
                {destinationName}
              </div>
            </div>
          </div>

          {/* Payment Status Notice */}
          {!isPaymentConfirmed && (
            <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-start gap-2 text-amber-800 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Payment of ₦{trip.payment_amount.toLocaleString()} is pending. Confirming departure will request payment verification.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons: Yes, Has Left (Green) & Not Yet (Grey) */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Grey button: Not Yet */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="w-full sm:w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-200 transition-colors cursor-pointer"
            id="departure-not-yet-btn"
          >
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>❌ Not Yet</span>
          </button>

          {/* Green button: Yes, Has Left */}
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirmDeparture}
            className="w-full sm:w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-transform hover:scale-105 active:scale-95 cursor-pointer"
            id="departure-confirm-yes-btn"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-white stroke-[3]" />
            )}
            <span>✅ Yes, Has Left</span>
          </button>
        </div>
      </div>
    </div>
  );
};
