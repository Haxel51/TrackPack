import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { 
  Printer, 
  Share2, 
  CheckCircle2, 
  MapPin, 
  Package, 
  User, 
  Phone, 
  ShieldCheck, 
  KeyRound, 
  Copy, 
  Check, 
  ArrowRight,
  Download,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WaybillPassData {
  tracking_code: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  origin_park: string;
  destination_park: string;
  item_description: string;
  quantity?: number;
  pickup_code?: string;
  estimated_fee?: number;
  payment_method?: string;
  created_at?: string;
  company_name?: string;
}

interface Props {
  passData: WaybillPassData;
  onClose?: () => void;
}

export const WaybillBarcodePass: React.FC<Props> = ({ passData, onClose }) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Generate QR code
    if (qrCanvasRef.current && passData.tracking_code) {
      QRCode.toCanvas(qrCanvasRef.current, passData.tracking_code, {
        width: 180,
        margin: 2,
        color: {
          dark: '#0A1F44',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      }).catch(err => console.error('QR code generation error:', err));
    }

    // Generate 1D Code128 Barcode
    if (barcodeSvgRef.current && passData.tracking_code) {
      try {
        JsBarcode(barcodeSvgRef.current, passData.tracking_code, {
          format: 'CODE128',
          lineColor: '#0A1F44',
          width: 2,
          height: 50,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.error('Barcode generation error:', err);
      }
    }
  }, [passData.tracking_code]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(passData.tracking_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = `🚚 *WAYBILLA PRE-BOOKING PASS*\n\n` +
      `*Tracking Code:* ${passData.tracking_code}\n` +
      `*Origin Park:* ${passData.origin_park}\n` +
      `*Destination:* ${passData.destination_park}\n` +
      `*Sender:* ${passData.sender_name} (${passData.sender_phone})\n` +
      `*Receiver:* ${passData.receiver_name} (${passData.receiver_phone})\n` +
      `*Item:* ${passData.item_description} (Qty: ${passData.quantity || 1})\n` +
      (passData.pickup_code ? `*Pickup PIN:* ${passData.pickup_code}\n\n` : '\n') +
      `👉 Show this code or QR at the motor park counter for 2-second express intake!\n` +
      `Track live: ${window.location.origin}/?track=${encodeURIComponent(passData.tracking_code)}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" id="waybill-digital-pass">
      {/* Success Badge */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 text-emerald-900">
        <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-black text-sm">Waybill Pre-Booked Successfully!</h4>
          <p className="text-xs text-emerald-700 font-medium">
            Your parcel is registered. Take it to the motor park counter and show this pass.
          </p>
        </div>
      </div>

      {/* The Official Printable / Scannable Ticket Card */}
      <div className="bg-white border-2 border-slate-900/10 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 print:shadow-none print:border-black">
        {/* Header Ribbon */}
        <div className="bg-[#0A1F44] text-white p-5 sm:p-6 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-orange-500/20 text-[#F7941D] px-2.5 py-0.5 rounded-full border border-orange-500/30">
                Self-Service Digital Pass
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-1">Waybill Pre-Booking</h3>
              <p className="text-xs text-slate-300 font-medium">
                {passData.company_name || 'Waybilla Interstate Transport Network'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
              <span className="inline-block bg-amber-400 text-[#0A1F44] font-black text-xs px-2.5 py-1 rounded-lg">
                Awaiting Counter Scan
              </span>
            </div>
          </div>
        </div>

        {/* Barcode & QR Code Section */}
        <div className="p-6 bg-gradient-to-b from-slate-50/80 to-white border-b border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
            Show this QR / Barcode at the Park Counter
          </div>

          {/* QR Code Canvas */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm inline-block">
            <canvas ref={qrCanvasRef} className="w-36 h-36 sm:w-44 sm:h-44 block" />
          </div>

          {/* 1D Barcode SVG */}
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-xs max-w-full overflow-hidden">
            <svg ref={barcodeSvgRef} className="h-10 sm:h-12 mx-auto" />
          </div>

          {/* Tracking Code Chip with Copy */}
          <div className="flex items-center gap-2">
            <div className="bg-[#0A1F44] text-[#F7941D] font-mono text-base sm:text-lg font-black tracking-widest px-4 py-2 rounded-xl shadow-xs select-all">
              {passData.tracking_code}
            </div>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-all cursor-pointer"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {copied && (
            <span className="text-xs text-emerald-600 font-bold animate-fadeIn">
              Tracking code copied to clipboard!
            </span>
          )}
        </div>

        {/* Route Details */}
        <div className="p-6 space-y-5">
          {/* Origin & Destination Nodes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" /> Departure Motor Park
              </span>
              <p className="font-extrabold text-sm text-[#0A1F44]">{passData.origin_park}</p>
            </div>
            <div className="space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Destination Park
              </span>
              <p className="font-extrabold text-sm text-[#0A1F44]">{passData.destination_park}</p>
            </div>
          </div>

          {/* Sender & Receiver Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Sender */}
            <div className="space-y-1 p-3.5 rounded-xl border border-slate-100 bg-white">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Sender Details</span>
              <p className="font-black text-[#0A1F44] text-sm">{passData.sender_name}</p>
              <p className="font-semibold text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> {passData.sender_phone}
              </p>
            </div>

            {/* Receiver */}
            <div className="space-y-1 p-3.5 rounded-xl border border-slate-100 bg-white">
              <span className="text-[10px] font-black uppercase text-slate-400 block">Receiver Details</span>
              <p className="font-black text-[#0A1F44] text-sm">{passData.receiver_name}</p>
              <p className="font-semibold text-slate-600 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> {passData.receiver_phone}
              </p>
            </div>
          </div>

          {/* Package Description & Secret Pickup PIN */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-orange-50/50 rounded-2xl border border-orange-100 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <span className="text-[10px] font-black uppercase text-orange-900/60 block">Package Description</span>
              <p className="font-extrabold text-slate-800 text-sm">{passData.item_description}</p>
              {passData.quantity && (
                <p className="text-[11px] text-slate-500 font-semibold">Quantity: {passData.quantity} parcel(s)</p>
              )}
            </div>

            {passData.pickup_code && (
              <div className="space-y-1 bg-white p-3 rounded-xl border border-orange-200 text-center sm:text-right">
                <span className="text-[10px] font-black uppercase text-orange-800 block flex items-center justify-center sm:justify-end gap-1">
                  <KeyRound className="w-3 h-3 text-orange-600" /> Receiver Pickup PIN
                </span>
                <p className="font-mono font-black text-xl text-orange-600 tracking-widest">
                  {passData.pickup_code}
                </p>
                <p className="text-[9px] text-slate-400 font-medium">Keep safe for collection</p>
              </div>
            )}
          </div>

          {/* Counter Step Instructions */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
            <h5 className="text-xs font-black text-[#0A1F44] flex items-center gap-1.5 uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> What to do at the Motor Park Counter:
            </h5>
            <ol className="text-xs text-slate-600 space-y-1.5 pl-4 list-decimal font-medium">
              <li>Bring your parcel to <strong>{passData.origin_park}</strong>.</li>
              <li>Show this <strong>QR Code</strong> or <strong>Tracking Code ({passData.tracking_code})</strong> to the counter staff.</li>
              <li>Staff will scan it in <strong>2 seconds</strong>, tag your luggage, and place it in the dispatch manifest!</li>
            </ol>
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-extrabold text-slate-700 shadow-xs cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print Pass</span>
            </button>
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm cursor-pointer transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Share to WhatsApp</span>
            </button>
          </div>

          <Link
            to={`/?track=${encodeURIComponent(passData.tracking_code)}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A1F44] hover:bg-[#143265] text-white text-xs font-extrabold shadow-sm cursor-pointer transition-all ml-auto"
          >
            <span>Track Live</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
