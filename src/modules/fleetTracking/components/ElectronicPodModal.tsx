import React, { useState } from 'react';
import { TripRecord } from '../types';
import { updateTripStatus } from '../api';
import {
  X,
  PackageCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  User,
  FileText,
  Lock,
  Building2,
  Check,
  Truck,
  Award,
} from 'lucide-react';

interface ElectronicPodModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripRecord | null;
  token: string;
  onPodCompleted: (trip: TripRecord) => void;
}

export const ElectronicPodModal: React.FC<ElectronicPodModalProps> = ({
  isOpen,
  onClose,
  trip,
  token,
  onPodCompleted,
}) => {
  if (!isOpen || !trip) return null;

  const [recipientName, setRecipientName] = useState<string>(trip.customer_contact_name || '');
  const [recipientPhone, setRecipientPhone] = useState<string>(trip.customer_contact_phone || '');
  const [sealVerified, setSealVerified] = useState<boolean>(true);
  const [goodsCondition, setGoodsCondition] = useState<string>('intact');
  const [quantityReceived, setQuantityReceived] = useState<string>(trip.cargo_quantity || '');
  const [remarks, setRemarks] = useState<string>('Discharged in good order. Quantities verified.');
  const [signatoryRole, setSignatoryRole] = useState<string>('Receiving Officer / Consignee');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeDestinationName = trip.redirect_destination?.name || trip.primary_destination_name || 'Destination Terminal';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!recipientName.trim()) {
      setError('Recipient / Receiving Officer name is required for e-POD certification.');
      return;
    }
    if (!recipientPhone.trim()) {
      setError('Recipient telephone number is required.');
      return;
    }
    if (trip.seal_number && !sealVerified) {
      setError('Please verify the security seal condition before discharging cargo.');
      return;
    }

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    const podReference = `POD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const podRecord = {
      pod_reference: podReference,
      recipient_name: recipientName.trim(),
      recipient_phone: recipientPhone.trim(),
      signatory_role: signatoryRole,
      seal_number: trip.seal_number || null,
      seal_verified: Boolean(sealVerified),
      goods_condition: goodsCondition,
      quantity_received: quantityReceived.trim(),
      remarks: remarks.trim(),
      discharged_at: nowIso,
      terminal_name: activeDestinationName,
      waybill_number: trip.waybill_number || 'N/A',
      plate_number: trip.plate_number,
      driver_name: trip.driver_name,
    };

    try {
      const auditNote = `Cargo delivered & e-POD clearance verified (${podReference}) by ${recipientName}. Seal: ${sealVerified ? 'Intact' : 'N/A'}. Condition: ${goodsCondition}.`;
      const res = await updateTripStatus(token, trip.id, 'completed', auditNote, {
        pod_record: podRecord,
      });

      if (res.success && res.trip) {
        onPodCompleted(res.trip);
        onClose();
      } else if (res.success) {
        onPodCompleted({
          ...trip,
          trip_status: 'completed',
          tracking_active: false,
          pod_record: podRecord,
          completed_at: nowIso,
        });
        onClose();
      } else {
        setError(res.error || 'Failed to complete e-POD clearance');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error processing e-POD');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
      id="electronic-pod-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col my-8 animate-scaleUp">
        
        {/* Header */}
        <div className="bg-[#0A1F44] px-6 py-5 border-b border-[#15346A] flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">Electronic Proof of Delivery (e-POD)</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-[#0A1F44] px-2 py-0.5 rounded-md">
                  Step 4 Discharged
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Waybill: <span className="font-mono text-[#F7941D] font-bold">{trip.waybill_number || 'N/A'}</span> • Truck: <span className="font-mono text-white font-bold">{trip.plate_number}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[65vh] custom-scrollbar text-xs">
          
          {/* Manifest Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-slate-700 font-extrabold">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Destination: {activeDestinationName}</span>
              </div>
              {trip.redirect_destination && (
                <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">
                  ↪️ Rerouted Destination
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block font-bold">Cargo Type</span>
                <span className="font-extrabold text-slate-800">{trip.cargo_type || 'General Freight'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Quantity</span>
                <span className="font-extrabold text-slate-800">{trip.cargo_quantity || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Driver Name</span>
                <span className="font-extrabold text-slate-800">{trip.driver_name}</span>
              </div>
            </div>
          </div>

          {/* Security Seal Lock Verification Section */}
          {trip.seal_number && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span className="font-extrabold text-slate-900">Security Seal Inspection</span>
                </div>
                <span className="font-mono font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300">
                  {trip.seal_number}
                </span>
              </div>
              <p className="text-[11px] text-amber-800">
                Confirm this container or tanker security seal was inspected and found intact prior to breaking for discharge.
              </p>
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sealVerified}
                  onChange={(e) => setSealVerified(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-extrabold text-slate-800">
                  Seal #{trip.seal_number} Verified Intact & Undamaged
                </span>
              </label>
            </div>
          )}

          {/* Consignee / Receiving Officer Inputs */}
          <div className="space-y-3 pt-1">
            <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] text-slate-500">
              Consignee Receiving Confirmation
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Receiving Officer / Consignee Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Engr. Tunde Adeleke"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Recipient Telephone Number *</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="e.g. +234 803 123 4567"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Consignee Signatory Title</label>
                <input
                  type="text"
                  value={signatoryRole}
                  onChange={(e) => setSignatoryRole(e.target.value)}
                  placeholder="e.g. Warehouse Supervisor / Station Manager"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivered Quantity Confirmed</label>
                <input
                  type="text"
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(e.target.value)}
                  placeholder="e.g. 40,000 Litres / 1 x 40ft Container"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
                />
              </div>
            </div>

            {/* Cargo Condition radio buttons */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">Cargo Condition Upon Discharge</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'intact', label: '✅ 100% Intact & Sound' },
                  { id: 'partial', label: '⚠️ Quantity Variance' },
                  { id: 'damaged', label: '❌ Damage Noted' },
                ].map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => setGoodsCondition(cond.id)}
                    className={`py-2 px-2.5 rounded-xl text-center font-extrabold transition-all cursor-pointer text-[11px] ${
                      goodsCondition === cond.id
                        ? 'bg-[#0A1F44] text-[#F7941D] shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Discharge Remarks / Notes</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Dip meter verified 40,000L. Density test passed. Discharged into Tank 2."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-[#F7941D]"
              />
            </div>
          </div>

          {/* Compliance & Legal Notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 flex items-start gap-2">
            <Award className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Submitting this electronic certificate will officially conclude this haulage trip, generate the permanent e-POD receipt, and stop active GPS telemetry tracking.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              id="submit-electronic-pod-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Certifying Delivery...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  <span>Certify Delivery & End Trip</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
