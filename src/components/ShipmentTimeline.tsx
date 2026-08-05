import React, { useState } from 'react';
import { 
  Package, 
  CheckCircle2, 
  Circle, 
  TrendingUp, 
  Bus, 
  MapPin, 
  Clock, 
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Building,
  Phone,
  Receipt,
  Printer,
  X,
  Check
} from 'lucide-react';

interface Waybill {
  id: string;
  tracking_code: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  item_description: string;
  bus_number: string;
  origin_park: string;
  destination_park: string;
  company_id: string;
  status: 'booked' | 'departed' | 'in_transit' | 'arrived' | 'collected';
  tracking_active: boolean;
  booked_at: string;
  departed_at: string | null;
  arrived_at: string | null;
  collected_at: string | null;
  collected_by: string | null;
  created_at: string;
}

interface RouteInfo {
  estimated_hours: number;
  average_actual_hours: number | null;
  completed_trips: number;
  effective_hours?: number;
  uses_learned_eta?: boolean;
  margin_hours?: number;
}

interface DriverInfo {
  driver_name: string | null;
  driver_phone: string;
}

interface ShipmentTimelineProps {
  waybill: Waybill;
  route?: RouteInfo;
  driver?: DriverInfo | null;
  showConfirmButton?: boolean;
  onConfirmReceived?: () => Promise<void>;
  isConfirming?: boolean;
}

export const ShipmentTimeline: React.FC<ShipmentTimelineProps> = ({
  waybill,
  route,
  driver = null,
  showConfirmButton = false,
  onConfirmReceived,
  isConfirming = false
}) => {
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const {
    status,
    origin_park,
    destination_park,
    bus_number,
    booked_at,
    departed_at,
    arrived_at,
    collected_at,
    collected_by,
    item_description,
    tracking_code
  } = waybill;

  // Feature 1: Route Learning ETA
  const usesLearnedEta = route ? (route.completed_trips >= 5 && route.average_actual_hours !== null) : false;
  const duration = usesLearnedEta
    ? (route!.average_actual_hours as number)
    : (route ? route.estimated_hours : 6.0);

  const marginHours = route?.margin_hours || Math.max(0.3, Math.round(duration * 0.12 * 10) / 10);

  // Status mapping to progress bar percentages
  const percentMap = {
    booked: 15,
    departed: 40,
    in_transit: 65,
    arrived: 90,
    collected: 100
  };

  const progressPercent = percentMap[status] || 15;

  // Format datetime helper
  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-NG', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  // Expected transit time range helper
  const getExpectedTimeRange = () => {
    const anchorDateStr = departed_at || booked_at;
    if (!anchorDateStr) return 'N/A';
    try {
      const anchorDate = new Date(anchorDateStr);
      if (isNaN(anchorDate.getTime())) return 'N/A';
      
      const expectedArrival = new Date(anchorDate.getTime() + duration * 60 * 60 * 1000);
      
      const startWindow = new Date(expectedArrival.getTime() - marginHours * 60 * 60 * 1000);
      const endWindow = new Date(expectedArrival.getTime() + marginHours * 60 * 60 * 1000);
      
      const formatTime = (d: Date) => {
        let hours = d.getHours();
        const minutes = d.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minStr = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minStr} ${ampm}`;
      };
      
      return `${formatTime(startWindow)} – ${formatTime(endWindow)}`;
    } catch (e) {
      return 'N/A';
    }
  };

  const expectedTimeRange = getExpectedTimeRange();

  // Feature 2: Warm Status Language
  const getWarmStatusText = () => {
    switch (status) {
      case 'booked':
        return `We've got your package! ${origin_park} is taking care of it.`;
      case 'departed':
        return `Your package just left ${origin_park}, riding on Bus ${bus_number}.`;
      case 'in_transit':
        return `On the way! Expected between ${expectedTimeRange}.`;
      case 'arrived':
        return `Good news — your package just reached ${destination_park}!`;
      case 'collected':
        return `Delivered! Your package made it safely. ✓`;
      default:
        return `Processing package at ${origin_park}.`;
    }
  };

  const warmStatusPhrase = getWarmStatusText();

  // Status color helpers
  const getStatusColorClass = (itemStatus: typeof status) => {
    if (itemStatus === 'booked') return 'amber';
    if (itemStatus === 'departed' || itemStatus === 'in_transit') return 'blue';
    return 'emerald';
  };

  const currentColor = getStatusColorClass(status);

  // Horizontal Timeline Points definition
  const points = [
    { label: 'Booked', status: 'booked' as const },
    { label: 'Departed', status: 'departed' as const },
    { label: 'In Transit', status: 'in_transit' as const },
    { label: 'Arrived', status: 'arrived' as const },
    { label: 'Collected', status: 'collected' as const }
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-md space-y-7 text-slate-800">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">WAYBILL CODE</span>
            <span className="bg-slate-100 text-slate-800 text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider">
              {tracking_code}
            </span>
          </div>
          <h3 className="text-lg font-extrabold text-[#0A1F44] mt-1 leading-tight">
            {item_description}
          </h3>
        </div>
        
        <div className="flex flex-col items-start sm:items-end">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">STATUS</span>
          <div className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider
            ${currentColor === 'amber' ? 'bg-amber-50 text-amber-700 border border-amber-200' : ''}
            ${currentColor === 'blue' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
            ${currentColor === 'emerald' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : ''}
          `}>
            <span className={`w-2 h-2 rounded-full 
              ${currentColor === 'amber' ? 'bg-amber-500 animate-pulse' : ''}
              ${currentColor === 'blue' ? 'bg-blue-500 animate-pulse' : ''}
              ${currentColor === 'emerald' ? 'bg-emerald-500' : ''}
            `} />
            {status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Feature 2: Prominent Warm Status Banner */}
      <div className={`rounded-2xl p-4.5 border transition-all ${
        currentColor === 'amber' ? 'bg-amber-50/80 border-amber-200 text-amber-900' :
        currentColor === 'blue' ? 'bg-blue-50/80 border-blue-200 text-blue-900' :
        'bg-emerald-50/80 border-emerald-200 text-emerald-900'
      }`}>
        <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">
          SHIPMENT UPDATE
        </p>
        <p className="text-base font-extrabold leading-snug">
          {warmStatusPhrase}
        </p>
      </div>

      {/* Origin -> Destination horizontal header */}
      <div className="flex items-center justify-between text-sm font-extrabold bg-[#FAFAFA] rounded-2xl p-4 border border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">ORIGIN PARK</p>
            <p className="text-slate-800 mt-0.5">{origin_park}</p>
          </div>
        </div>
        <ArrowRight className="w-5 h-5 text-slate-300" />
        <div className="flex items-center gap-2 text-right">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">DESTINATION PARK</p>
            <p className="text-slate-800 mt-0.5">{destination_park}</p>
          </div>
          <MapPin className="w-4 h-4 text-[#F2A93B]" />
        </div>
      </div>

      {/* Feature 3: Clean, Premium Modern Progress Indicator with Moving Icon Badge */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shadow-xs">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Live Transit Progress</p>
              <p className="text-xs font-black text-[#0A1F44] capitalize">{status.replace('_', ' ')} ({progressPercent}%)</p>
            </div>
          </div>
          <span className="text-xs font-extrabold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5">
            <Bus className="w-3.5 h-3.5 text-blue-600" /> Bus {bus_number}
          </span>
        </div>

        {/* Progress Bar Track with Moving Icon */}
        <div className="relative pt-6 pb-2 px-1">
          <div className="h-3 bg-slate-200/90 rounded-full w-full absolute top-1/2 -translate-y-1/2 left-0 z-0 shadow-inner overflow-hidden">
            <div 
              className={`h-full transition-all duration-700 ease-out rounded-full ${
                currentColor === 'amber' ? 'bg-amber-500' :
                currentColor === 'blue' ? 'bg-blue-600' : 'bg-emerald-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Moving Icon Badge */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-700 ease-out"
            style={{ left: `calc(${progressPercent}% - 18px)` }}
          >
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md border-2 text-white transition-colors duration-500
              ${currentColor === 'amber' ? 'bg-amber-500 border-white' : ''}
              ${currentColor === 'blue' ? 'bg-blue-600 border-white animate-pulse' : ''}
              ${currentColor === 'emerald' ? 'bg-emerald-600 border-white' : ''}
            `}>
              {status === 'booked' ? (
                <Package className="w-4 h-4" />
              ) : status === 'collected' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Bus className="w-4 h-4" />
              )}
            </div>
          </div>

          <div className="flex justify-between relative z-0 text-[11px] font-bold text-slate-500 pt-1">
            <span>{origin_park}</span>
            <span>{destination_park}</span>
          </div>
        </div>
      </div>

      {/* Vertical Timeline */}
      <div className="border-t border-slate-100 pt-6 space-y-6">
        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-4">
          Shipment Timeline
        </h4>

        <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
          
          {/* 1. Booked Stage */}
          <div className="relative">
            {/* Timeline node */}
            <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white
              ${booked_at ? 'border-amber-500 text-amber-500' : 'border-slate-200 text-slate-300'}
            `}>
              <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className={`text-sm font-extrabold ${booked_at ? 'text-slate-900' : 'text-slate-400'}`}>
                  Booked & Received
                </h5>
                {booked_at && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {formatDateTime(booked_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                We've got your package! {origin_park} is taking care of it.
              </p>
            </div>
          </div>

          {/* 2. Departed Stage */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white
              ${departed_at ? 'border-blue-500 text-blue-500' : 'border-slate-200 text-slate-300'}
            `}>
              <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className={`text-sm font-extrabold ${departed_at ? 'text-slate-900' : 'text-slate-400'}`}>
                  Departed Park
                </h5>
                {departed_at && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {formatDateTime(departed_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {departed_at 
                  ? `Your package just left ${origin_park} on Bus ${bus_number}.`
                  : `Awaiting dispatch from ${origin_park}.`
                }
              </p>
            </div>
          </div>

          {/* 3. In Transit Stage (Always shows expected window) */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white
              ${(status === 'in_transit' || status === 'arrived' || status === 'collected') ? 'border-blue-500 text-blue-500' : 'border-slate-200 text-slate-300'}
            `}>
              <Clock className="w-3.5 h-3.5 bg-white rounded-full" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className={`text-sm font-extrabold ${(status === 'in_transit' || status === 'arrived' || status === 'collected') ? 'text-slate-900' : 'text-slate-400'}`}>
                  In Transit
                </h5>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                On the way! Expected between <strong className="text-blue-600 font-bold">{expectedTimeRange}</strong>.
              </p>
              {route && (
                <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <span>Based on {route.completed_trips >= 5 ? 'route history actuals' : 'estimated route duration'} ({duration}h)</span>
                </p>
              )}
            </div>
          </div>

          {/* 4. Arrived Stage */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white
              ${arrived_at ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}
            `}>
              <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className={`text-sm font-extrabold ${arrived_at ? 'text-slate-900' : 'text-slate-400'}`}>
                  Arrived at Destination
                </h5>
                {arrived_at && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {formatDateTime(arrived_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {arrived_at
                  ? `Good news — your package has reached ${destination_park}!`
                  : `Will be sorted on arrival at ${destination_park}.`
                }
              </p>
            </div>
          </div>

          {/* 5. Collected Stage */}
          <div className="relative">
            <span className={`absolute -left-[31px] top-0 rounded-full w-5 h-5 flex items-center justify-center border-2 bg-white
              ${collected_at ? 'border-emerald-500 text-emerald-500' : 'border-slate-200 text-slate-300'}
            `}>
              <CheckCircle2 className="w-3.5 h-3.5 fill-current bg-white rounded-full" />
            </span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h5 className={`text-sm font-extrabold ${collected_at ? 'text-slate-900' : 'text-slate-400'}`}>
                  Collected & Delivered
                </h5>
                {collected_at && (
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {formatDateTime(collected_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {collected_at
                  ? `Delivered! Your package made it safely. ✓ (${collected_by === 'receiver' ? 'confirmed by receiver' : 'confirmed by staff'})`
                  : `Awaiting collection by receiver at ${destination_park}.`
                }
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Consignee / Consignor Details (For Customer Visibility) */}
      <div className="border-t border-slate-100 pt-5 grid grid-cols-2 gap-4 text-xs">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <p className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">SENDER (CONSIGNOR)</p>
          <p className="font-extrabold text-slate-800 mt-1">{waybill.sender_name}</p>
          <p className="text-slate-500 mt-0.5">{waybill.sender_phone}</p>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
          <p className="font-extrabold text-slate-400 uppercase tracking-wider text-[10px]">RECEIVER (CONSIGNEE)</p>
          <p className="font-extrabold text-slate-800 mt-1">{waybill.receiver_name}</p>
          <p className="text-slate-500 mt-0.5">{waybill.receiver_phone}</p>
        </div>
      </div>

      {/* Driver Details (Call Driver CTA) */}
      {driver && (
        <div className="border-t border-slate-100 pt-5">
          <div className="bg-blue-50/55 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100/80 rounded-xl flex items-center justify-center shrink-0">
                <Bus className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <p className="font-extrabold text-slate-400 uppercase tracking-wider text-[9px] leading-none">DRIVER DETAILS</p>
                <p className="font-extrabold text-[#0A1F44] mt-1.5 text-sm">{driver.driver_name || 'Dispatch Driver'}</p>
                <p className="text-xs text-slate-500 mt-0.5">Vehicle: {waybill.bus_number}</p>
              </div>
            </div>
            
            <a 
              href={`tel:${driver.driver_phone}`}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4.5 py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              Call Driver ({driver.driver_phone})
            </a>
          </div>
        </div>
      )}

      {/* Confirm Received CTA Button (if permitted and visible) */}
      {showConfirmButton && status === 'arrived' && (
        <div className="pt-2">
          <button
            onClick={onConfirmReceived}
            disabled={isConfirming}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold py-4 px-6 rounded-2xl transition-all shadow-sm active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            {isConfirming ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <UserCheck className="w-5 h-5" />
            )}
            Confirm Received (Delivered)
          </button>
        </div>
      )}

      {status === 'collected' && showConfirmButton && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-4 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Package Collected & Receipt Confirmed ✓
        </div>
      )}

      {/* Digital Receipt Button */}
      <div className="pt-2 border-t border-slate-100 mt-4">
        <button
          onClick={() => setShowReceiptModal(true)}
          className="w-full bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold py-3.5 px-6 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 text-xs shadow-xs"
        >
          <Receipt className="w-4 h-4 text-[#F2A93B]" />
          View Digital Waybill History Receipt 🧾
        </button>
      </div>

      {/* Digital Waybill History Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-[#0A1F44]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="digital-waybill-receipt-modal">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 relative border border-slate-100">
            <button
              onClick={() => setShowReceiptModal(false)}
              className="absolute top-5 right-5 p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Header */}
            <div className="text-center border-b border-slate-100 pb-5 space-y-2">
              <div className="w-12 h-12 bg-[#0A1F44] rounded-2xl mx-auto flex items-center justify-center text-[#F2A93B] shadow-md">
                <Receipt className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-[#0A1F44]">TrackPack Nigeria</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Official Digital Waybill Transaction Receipt</p>
              <div className="inline-block bg-blue-50 text-blue-700 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider mt-1">
                Ref: {tracking_code}
              </div>
            </div>

            {/* Transaction Overview Grid */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[10px]">Origin Terminal</span>
                <span className="font-extrabold text-[#0A1F44] text-sm block mt-0.5">{origin_park}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-bold uppercase text-[10px]">Destination Terminal</span>
                <span className="font-extrabold text-[#0A1F44] text-sm block mt-0.5">{destination_park}</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-slate-400 block font-bold uppercase text-[10px]">Item Description</span>
                <span className="font-bold text-slate-800 text-sm block mt-0.5">{item_description}</span>
              </div>
            </div>

            {/* Parties Involved */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/60 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Consignor (Sender)</span>
                <p className="font-extrabold text-slate-800 text-sm">{waybill.sender_name}</p>
                <p className="text-slate-500 font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {waybill.sender_phone}
                </p>
              </div>
              <div className="border border-slate-100 p-4 rounded-2xl bg-slate-50/60 space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Consignee (Receiver)</span>
                <p className="font-extrabold text-slate-800 text-sm">{waybill.receiver_name}</p>
                <p className="text-slate-500 font-medium flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" /> {waybill.receiver_phone}
                </p>
              </div>
            </div>

            {/* Vehicle & Driver Details */}
            <div className="border border-slate-100 p-4 rounded-2xl bg-blue-50/40 space-y-1.5 text-xs">
              <span className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">Vehicle & Driver Allocation</span>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-bold">Bus / Vehicle No:</span>
                <span className="font-black text-[#0A1F44]">{bus_number}</span>
              </div>
              {driver && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-bold">Driver Name:</span>
                    <span className="font-black text-[#0A1F44]">{driver.driver_name || 'Assigned Driver'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-bold">Driver Phone:</span>
                    <span className="font-black text-[#0A1F44]">{driver.driver_phone}</span>
                  </div>
                </>
              )}
            </div>

            {/* Chronological Audit Trail (Nothing hidden) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black text-[#0A1F44] uppercase tracking-wider">Audit Trail & Transaction History</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="font-bold text-slate-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Waybill Created / Booked
                  </span>
                  <span className="font-medium text-slate-500">{formatDateTime(waybill.created_at || booked_at)}</span>
                </div>
                {departed_at && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Bus Departed Origin
                    </span>
                    <span className="font-medium text-slate-500">{formatDateTime(departed_at)}</span>
                  </div>
                )}
                {arrived_at && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-600 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Arrived Destination Park
                    </span>
                    <span className="font-medium text-slate-500">{formatDateTime(arrived_at)}</span>
                  </div>
                )}
                {collected_at && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> Delivered & Collected ({collected_by === 'receiver' ? 'Verified by Receiver Phone' : 'Staff Confirmed'})
                    </span>
                    <span className="font-bold text-emerald-700">{formatDateTime(collected_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Receipt Footer & Actions */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-between gap-3">
              <button
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-[#0A1F44] font-extrabold px-4 py-3 rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print / Save Receipt
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="bg-[#0A1F44] hover:bg-blue-900 text-white font-extrabold px-6 py-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
