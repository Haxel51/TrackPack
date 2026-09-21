import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Scan, 
  Search, 
  ArrowLeft, 
  CheckCircle2, 
  Truck, 
  Package, 
  ShieldCheck, 
  MapPin, 
  User, 
  Phone, 
  AlertCircle,
  Camera,
  XCircle,
  RefreshCw
} from 'lucide-react';

interface PreBookedIntakeProps {
  token: string;
  originPark: string;
  onBackToMenu: () => void;
}

interface PreBookedWaybill {
  id: string;
  tracking_code: string;
  sender_name: string;
  sender_phone: string;
  receiver_name: string;
  receiver_phone: string;
  item_description: string;
  origin_park: string;
  destination_park: string;
  status: string;
  source?: string;
  api_merchant_name?: string;
  paid?: boolean;
  created_at?: string;
}

interface BusOption {
  id: string;
  bus_number: string;
  destination_park: string;
  driver_name?: string;
  driver_phone?: string;
  status: string;
}

export const PreBookedIntake: React.FC<PreBookedIntakeProps> = ({
  token,
  originPark,
  onBackToMenu
}) => {
  const [trackingInput, setTrackingInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [waybill, setWaybill] = useState<PreBookedWaybill | null>(null);
  const [availableBuses, setAvailableBuses] = useState<BusOption[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string>('unassigned');
  const [freightFare, setFreightFare] = useState<string>('');
  
  const [isProcessingIntake, setIsProcessingIntake] = useState(false);
  const [intakeSuccess, setIntakeSuccess] = useState<string | null>(null);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'prebooked-qr-reader';

  const handleLookup = async (codeToSearch?: string) => {
    const code = (codeToSearch || trackingInput).trim().toUpperCase();
    if (!code) {
      setSearchError('Please enter or scan a tracking code.');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setIntakeSuccess(null);
    setWaybill(null);

    try {
      const res = await fetch('/api/staff/prebooked-waybills/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Waybill not found or not eligible for intake.');
      }

      setWaybill(data.waybill);
      setAvailableBuses(data.available_buses || []);
      if (data.available_buses && data.available_buses.length > 0) {
        setSelectedBusId(data.available_buses[0].id);
      } else {
        setSelectedBusId('unassigned');
      }
    } catch (err: any) {
      setSearchError(err.message || 'Failed to find waybill.');
    } finally {
      setIsSearching(false);
    }
  };

  // Start Scanner
  const startScanner = async () => {
    setIsScannerOpen(true);
    setScannerError(null);

    // Short timeout to ensure DOM element exists
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(scannerContainerId);
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            // Clean up and search
            let cleanCode = decodedText.trim();
            if (cleanCode.includes('code=')) {
              const match = cleanCode.match(/code=([^&]+)/);
              if (match) cleanCode = decodeURIComponent(match[1]);
            }
            stopScanner();
            setTrackingInput(cleanCode);
            handleLookup(cleanCode);
          },
          () => {
            // Frame scan miss, normal
          }
        );
      } catch (err: any) {
        console.error('Camera scan start error:', err);
        setScannerError('Could not open camera. Please grant camera permissions or type code manually.');
      }
    }, 200);
  };

  // Stop Scanner
  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current
        .stop()
        .then(() => {
          html5QrCodeRef.current?.clear();
          html5QrCodeRef.current = null;
        })
        .catch((err) => console.error('Error stopping scanner:', err));
    }
    setIsScannerOpen(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleConfirmIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waybill) return;

    setIsProcessingIntake(true);
    setSearchError(null);

    try {
      const res = await fetch('/api/staff/prebooked-waybills/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          waybill_id: waybill.id,
          bus_id: selectedBusId,
          freight_fare_collected: freightFare ? parseFloat(freightFare) : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete intake.');
      }

      setIntakeSuccess(data.message || `Waybill ${waybill.tracking_code} received and loaded!`);
      setWaybill(null);
      setTrackingInput('');
      setFreightFare('');
    } catch (err: any) {
      setSearchError(err.message || 'Error processing intake.');
    } finally {
      setIsProcessingIntake(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12" id="prebooked-intake-screen">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToMenu}
          className="inline-flex items-center gap-2 text-sm font-black text-slate-700 hover:text-[#0A1F44] transition-colors cursor-pointer bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </button>
        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
          Terminal: <strong className="text-[#0A1F44]">{originPark}</strong>
        </span>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 text-xs font-black px-3 py-1.5 rounded-xl mb-2">
            <Scan className="w-4 h-4 text-blue-600" />
            Fast Inflow Counter
          </div>
          <h2 className="text-2xl font-black text-[#0A1F44]">
            Scan or Enter Pre-Booked Waybill
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Intake waybills pre-registered online or via Developer API (e-commerce stores, merchants, logistics partners). No repetitive typing!
          </p>
        </div>

        {/* Input Bar & Camera Toggle */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="prebooked-code-input"
                type="text"
                placeholder="Enter Tracking Code (e.g. NNW-8291)"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-black tracking-wider text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            <button
              id="prebooked-lookup-btn"
              onClick={() => handleLookup()}
              disabled={isSearching || !trackingInput.trim()}
              className="bg-[#0A1F44] text-white px-6 py-3.5 rounded-2xl font-extrabold hover:bg-blue-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Lookup Waybill
                </>
              )}
            </button>

            <button
              id="prebooked-camera-scan-btn"
              onClick={isScannerOpen ? stopScanner : startScanner}
              type="button"
              className="bg-[#F7941D] text-[#0A1F44] px-5 py-3.5 rounded-2xl font-black hover:bg-orange-400 transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
            >
              {isScannerOpen ? (
                <>
                  <XCircle className="w-5 h-5" />
                  Close Camera
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  Scan Barcode
                </>
              )}
            </button>
          </div>

          {/* Camera Scanner Viewport */}
          {isScannerOpen && (
            <div className="p-4 bg-slate-900 rounded-3xl border-2 border-dashed border-blue-400 text-center space-y-3 animate-fadeIn">
              <p className="text-xs font-bold text-white flex items-center justify-center gap-2">
                <Scan className="w-4 h-4 text-[#F7941D] animate-pulse" />
                Point camera directly at the barcode or QR on the parcel or waybill slip
              </p>
              <div 
                id={scannerContainerId} 
                className="overflow-hidden rounded-2xl max-w-sm mx-auto bg-black" 
                style={{ width: '100%', minHeight: '260px' }}
              />
              {scannerError && (
                <p className="text-xs text-rose-400 font-semibold">{scannerError}</p>
              )}
              <button
                type="button"
                onClick={stopScanner}
                className="text-xs text-slate-300 underline font-bold hover:text-white"
              >
                Cancel scanning
              </button>
            </div>
          )}
        </div>

        {/* Error Feedback */}
        {searchError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Success Feedback */}
        {intakeSuccess && (
          <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Intake Confirmed!
            </div>
            <p className="text-xs font-medium text-emerald-700">{intakeSuccess}</p>
            <div className="pt-2">
              <button
                onClick={() => setIntakeSuccess(null)}
                className="text-xs font-black text-emerald-800 underline cursor-pointer"
              >
                + Scan Another Pre-Booked Waybill
              </button>
            </div>
          </div>
        )}

        {/* Found Waybill Card & Intake Form */}
        {waybill && (
          <form onSubmit={handleConfirmIntake} className="space-y-6 pt-4 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-5">
              {/* Card Header with Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-black text-[#0A1F44] tracking-wider">
                    {waybill.tracking_code}
                  </span>
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                    {waybill.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Tracking Fee: Verified Paid (API)
                  </span>
                </div>
              </div>

              {/* Item Info */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Package Description</p>
                  <p className="text-sm font-black text-slate-900">{waybill.item_description}</p>
                  {waybill.api_merchant_name && (
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Booked by: <strong className="text-blue-700">{waybill.api_merchant_name}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Route Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-orange-500" /> Origin Drop-Off
                  </p>
                  <p className="text-xs font-bold text-slate-800">{originPark} (This Park)</p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Destination Park
                  </p>
                  <p className="text-xs font-black text-[#0A1F44]">{waybill.destination_park}</p>
                </div>
              </div>

              {/* Sender & Receiver Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1 text-xs">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" /> Sender
                  </p>
                  <p className="font-bold text-slate-900">{waybill.sender_name}</p>
                  <p className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {waybill.sender_phone}
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-1 text-xs">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" /> Receiver
                  </p>
                  <p className="font-bold text-slate-900">{waybill.receiver_name}</p>
                  <p className="text-slate-500 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {waybill.receiver_phone}
                  </p>
                </div>
              </div>

              {/* Staff Action Fields */}
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    Assign Outgoing Vehicle for this Package
                  </label>
                  <select
                    id="prebooked-select-bus"
                    value={selectedBusId}
                    onChange={(e) => setSelectedBusId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    <option value="unassigned">Keep in Terminal (Assign Vehicle Later)</option>
                    {availableBuses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bus_number} &rarr; {b.destination_park} {b.driver_name ? `(Driver: ${b.driver_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1.5">
                    Counter Freight Fare Collected from Sender / Rider (₦) — Optional
                  </label>
                  <input
                    id="prebooked-freight-fare-input"
                    type="number"
                    placeholder="e.g. 1500 (Leave empty if paid on delivery or on account)"
                    value={freightFare}
                    onChange={(e) => setFreightFare(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Note: The ₦200 digital tracking fee is already verified via API. Any freight fare entered above is your park's transport charge.
                  </p>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <button
              id="confirm-intake-submit-btn"
              type="submit"
              disabled={isProcessingIntake}
              className="w-full bg-[#0A1F44] text-white py-4 px-6 rounded-2xl text-sm font-black hover:bg-blue-900 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessingIntake ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Confirming Intake & Updating Milestone...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Confirm Physical Intake & Activate Milestone &rarr;
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
