import React from 'react';
import { TripRecord } from '../types';
import {
  X,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  Building2,
  Truck,
  Package,
  Calendar,
  Clock,
  ShieldCheck,
  MapPin,
  Share2,
  Navigation,
  FileText,
  User,
  Phone,
  Lock,
  Award,
} from 'lucide-react';

interface WaybillCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripRecord | null;
}

export const WaybillCertificateModal: React.FC<WaybillCertificateModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  const [copied, setCopied] = React.useState<boolean>(false);

  if (!isOpen || !trip) return null;

  const publicTrackUrl = `${window.location.origin}/track/fleet/${trip.id}`;
  const pod = trip.pod_record;
  const isCompleted = trip.trip_status === 'completed';
  const hasRedirect = !!trip.redirect_destination;
  const activeDestName = trip.redirect_destination?.name || trip.primary_destination_name || 'Destination Terminal';
  const activeDestAddress = trip.redirect_destination?.address || 'Designated discharge point';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicTrackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn overflow-y-auto print:p-0 print:bg-white"
      id="waybill-certificate-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-8 print:border-none print:shadow-none print:rounded-none">
        
        {/* Modal Top Bar (hidden on print) */}
        <div className="bg-[#0A1F44] px-6 py-4 border-b border-[#15346A] flex items-center justify-between text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[#F7941D]" />
            <h3 className="text-sm font-black">Waybill Manifest & Delivery Certificate</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="bg-[#F7941D] hover:bg-[#e08215] text-[#0A1F44] font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Link' : 'Copy Track Link'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Certificate Body */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800 bg-white">
          
          {/* Certificate Header with Logo / Brand */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-[#0A1F44] tracking-tight">WAYBILLA</span>
                <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded bg-[#F7941D] text-[#0A1F44]">
                  FLEET LOGISTICS
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                Official Haulage Consignment & Delivery Certificate
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Waybill Serial Number</span>
              <span className="text-base font-mono font-black text-[#0A1F44] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 inline-block mt-0.5">
                {trip.waybill_number || `WB-${trip.id.substring(0, 8).toUpperCase()}`}
              </span>
            </div>
          </div>

          {/* Status Stamp Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-[#F7941D] animate-pulse'}`} />
              <span className="font-extrabold text-slate-900">
                Consignment Status: <span className="uppercase">{trip.trip_status?.replace(/_/g, ' ')}</span>
              </span>
            </div>

            {isCompleted ? (
              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl font-black text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>e-POD DISCHARGED</span>
              </span>
            ) : (
              <span className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1 rounded-xl font-black text-[11px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>IN-TRANSIT TELEMETRY ACTIVE</span>
              </span>
            )}
          </div>

          {/* Section 1: Asset & Driver Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#0A1F44]" />
                <span>Assigned Fleet Asset</span>
              </span>
              <div className="font-mono font-black text-sm text-[#0A1F44]">{trip.plate_number}</div>
              <div className="text-slate-600 font-medium">Tracking Status: {trip.tracking_active ? 'Active GPS Tracking' : 'Completed / Archived'}</div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#0A1F44]" />
                <span>Operating Driver</span>
              </span>
              <div className="font-black text-sm text-slate-900">{trip.driver_name}</div>
              <div className="text-slate-600 font-medium flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span>{trip.driver_phone || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Universal Cargo Manifest */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-[#F7941D]" />
                <span>Universal Cargo Manifest</span>
              </span>
              <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                {trip.cargo_type || 'General Freight'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-slate-400 block font-bold">Quantity / Volume</span>
                <span className="font-black text-slate-900">{trip.cargo_quantity || '1 Consignment'}</span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 block font-bold">Cargo Description</span>
                <span className="font-extrabold text-slate-900">{trip.cargo_description || 'Commercial freight goods in sound condition.'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold">Security Seal Lock</span>
                {trip.seal_number ? (
                  <span className="font-mono font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block">
                    🔒 {trip.seal_number}
                  </span>
                ) : (
                  <span className="text-slate-400 italic">None required</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Route & Terminals (with Redirection endorsement if applicable) */}
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>Route & Loading Hub Terminals</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
              {/* Origin Hub */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block">1. Origin Terminal / Depot</span>
                <span className="font-extrabold text-slate-900 block">{trip.primary_destination_name}</span>
                <span className="text-slate-500 text-[10px]">{trip.created_at ? new Date(trip.created_at).toLocaleString() : ''}</span>
              </div>

              {/* Destination Hub */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold block">2. Final Delivery Destination</span>
                <span className="font-extrabold text-slate-900 block">{activeDestName}</span>
                <span className="text-slate-500 text-[10px]">{activeDestAddress}</span>
              </div>
            </div>

            {/* Mid-Transit Redirection Endorsement */}
            {hasRedirect && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <span>↪️ Mid-Transit Route Redirection Endorsement:</span>
                </div>
                <p className="text-amber-800">
                  Consignment redirected to <strong>{trip.redirect_destination?.name}</strong>.
                  {trip.redirect_destination?.reason && ` Reason: "${trip.redirect_destination.reason}".`}
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Proof of Delivery (e-POD) Sign-Off Block */}
          <div className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-emerald-600" />
                <span>Electronic Proof of Delivery (e-POD) Clearance</span>
              </span>
              {pod ? (
                <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                  Ref: {pod.pod_reference}
                </span>
              ) : (
                <span className="text-[10px] text-amber-700 font-bold italic">
                  Pending Consignee Discharge
                </span>
              )}
            </div>

            {pod ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
                <div className="space-y-1">
                  <span className="text-slate-500 block font-bold">Consignee Receiving Officer</span>
                  <span className="font-black text-slate-900 text-xs block">{pod.recipient_name}</span>
                  <span className="text-slate-500 block">{pod.signatory_role || 'Receiving Officer'}</span>
                  <span className="text-slate-500 block font-mono">{pod.recipient_phone}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 block font-bold">Discharge Verification</span>
                  <span className="font-bold text-slate-800 block">Condition: {pod.goods_condition === 'intact' ? '100% Intact & Sound' : pod.goods_condition}</span>
                  <span className="font-bold text-slate-800 block">Quantity Received: {pod.quantity_received || trip.cargo_quantity}</span>
                  <span className="text-slate-500 block text-[10px]">Timestamp: {new Date(pod.discharged_at).toLocaleString()}</span>
                </div>

                {pod.remarks && (
                  <div className="sm:col-span-2 pt-1 border-t border-slate-200 text-slate-600 text-[10px]">
                    <strong>Remarks:</strong> {pod.remarks}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">
                This cargo is currently en route. The digital e-POD verification and seal clearance will appear here immediately upon terminal discharge.
              </p>
            )}
          </div>

          {/* Certificate Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <div>Waybilla Intelligent Fleet Tracking Network • Verified Digital Certificate</div>
            <div className="font-mono">Ref: {trip.id}</div>
          </div>

        </div>

      </div>
    </div>
  );
};
