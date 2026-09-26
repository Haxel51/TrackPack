import React, { useState, useEffect } from 'react';
import { TruckProfile, SupplierLocation } from '../types';
import {
  getTruckProfiles,
  getSupplierLocations,
  initializeTripCreationPayment,
  verifyTripPaymentAndCreate,
  createTripDirectly,
} from '../api';
import {
  X,
  Truck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Navigation,
  CreditCard,
  Phone,
  User,
  ExternalLink,
  Radio,
  Fuel,
  Bus,
  Package,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onTripCreated: (createdTrip?: any) => void;
}

const CARGO_CATEGORIES = [
  { id: 'petroleum', name: 'Fuel & Gas (PMS/AGO/LPG)', icon: Fuel, placeholderQty: 'e.g. 45,000 Litres' },
  { id: 'cement', name: 'Cement & Building Materials', icon: Package, placeholderQty: 'e.g. 900 Bags (45 Tons)' },
  { id: 'container', name: '40ft / 20ft Container Freight', icon: Truck, placeholderQty: 'e.g. 1x 40ft High-Cube' },
  { id: 'fmcg', name: 'FMCG, Food & Beverage', icon: Package, placeholderQty: 'e.g. 24 Pallets (15T)' },
  { id: 'transit', name: 'Interstate Passenger Transit', icon: Bus, placeholderQty: 'e.g. 32 Passengers' },
  { id: 'general', name: 'General Haulage & Equipment', icon: Truck, placeholderQty: 'e.g. 28 Tons Cargo' },
];

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  token,
  onTripCreated,
}) => {
  const [trucks, setTrucks] = useState<TruckProfile[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLocation[]>([]);

  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Assigned Driver State (Auto-populated from truck, fully editable for relief drivers)
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');

  // Cargo & Dispatch Manifest State
  const [showCargoDetails, setShowCargoDetails] = useState<boolean>(false);
  const [cargoType, setCargoType] = useState<string>('petroleum');
  const [waybillNumber, setWaybillNumber] = useState<string>(() => `WB-${Math.floor(100000 + Math.random() * 900000)}`);
  const [cargoQuantity, setCargoQuantity] = useState<string>('');
  const [sealNumber, setSealNumber] = useState<string>('');
  const [cargoDescription, setCargoDescription] = useState<string>('');
  const [customerContactName, setCustomerContactName] = useState<string>('');
  const [customerContactPhone, setCustomerContactPhone] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Paystack modal state
  const [paystackModalOpen, setPaystackModalOpen] = useState<boolean>(false);
  const [paystackData, setPaystackData] = useState<{
    reference: string;
    checkout_url: string;
    amount: number;
    payment_plan: 'per_trip' | 'monthly';
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
      setSelectedTruckId('');
      setSelectedSupplierId('');
      setDriverName('');
      setDriverPhone('');
      setShowCargoDetails(false);
      setWaybillNumber(`WB-${Math.floor(100000 + Math.random() * 900000)}`);
      setCargoQuantity('');
      setSealNumber('');
      setCargoDescription('');
      setCustomerContactName('');
      setCustomerContactPhone('');
      setError(null);
      setPaystackModalOpen(false);
      setPaystackData(null);
    }
  }, [isOpen]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);

    const [trucksRes, suppliersRes] = await Promise.all([
      getTruckProfiles(token),
      getSupplierLocations(token),
    ]);

    if (trucksRes.success && trucksRes.trucks) {
      setTrucks(trucksRes.trucks);
      // If there are trucks, auto-select the first one if available
      if (trucksRes.trucks.length > 0) {
        const first = trucksRes.trucks[0];
        setSelectedTruckId(first.id);
        setDriverName(first.driver_name || '');
        setDriverPhone(first.driver_phone || '');
      }
    } else {
      setError(trucksRes.error || 'Failed to fetch trucks');
    }

    if (suppliersRes.success && suppliersRes.suppliers) {
      setSuppliers(suppliersRes.suppliers);
      if (suppliersRes.suppliers.length > 0) {
        setSelectedSupplierId(suppliersRes.suppliers[0].id);
      }
    } else {
      setError(suppliersRes.error || 'Failed to fetch destinations');
    }

    setIsLoading(false);
  };

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // When user switches truck dropdown, auto-populate driver info from that truck
  const handleTruckChange = (truckId: string) => {
    setSelectedTruckId(truckId);
    const trk = trucks.find((t) => t.id === truckId);
    if (trk) {
      setDriverName(trk.driver_name || '');
      setDriverPhone(trk.driver_phone || '');
    }
  };

  const isMonthlyActive = (truck?: TruckProfile): boolean => {
    if (!truck || truck.payment_plan !== 'monthly' || !truck.subscription_active_until) {
      return false;
    }
    return new Date(truck.subscription_active_until).getTime() > Date.now();
  };

  const getCargoPayload = () => ({
    driver_name: driverName.trim(),
    driver_phone: driverPhone.trim(),
    cargo_type: CARGO_CATEGORIES.find(c => c.id === cargoType)?.name || cargoType,
    cargo_description: cargoDescription.trim(),
    waybill_number: waybillNumber.trim(),
    cargo_quantity: cargoQuantity.trim(),
    seal_number: sealNumber.trim(),
    customer_contact_name: customerContactName.trim(),
    customer_contact_phone: customerContactPhone.trim(),
  });

  const handleDispatchTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTruck) {
      setError('Please select a vehicle/truck for this trip.');
      return;
    }

    if (!selectedSupplier) {
      setError('Please select a destination terminal or customer hub.');
      return;
    }

    if (!driverName.trim()) {
      setError('Please enter or verify the driver name.');
      return;
    }

    if (!driverPhone.trim()) {
      setError('Please enter or verify the driver phone number.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const activeMonthly = isMonthlyActive(selectedTruck);
    const cargoData = getCargoPayload();

    // 1. Direct creation if monthly plan is active
    if (selectedTruck.payment_plan === 'monthly' && activeMonthly) {
      const res = await createTripDirectly(token, selectedTruck.id, selectedSupplier.id, cargoData);

      if (res.success && res.trip) {
        setIsSubmitting(false);
        onTripCreated(res.trip);
      } else {
        setIsSubmitting(false);
        setError(res.error || 'Failed to create trip under monthly plan');
      }
      return;
    }

    // 2. Initialize Paystack for Per-Trip plan or renewal
    const res = await initializeTripCreationPayment(
      token,
      selectedTruck.id,
      selectedSupplier.id,
      selectedTruck.payment_plan || 'per_trip',
      cargoData
    );

    setIsSubmitting(false);

    if (res.success && res.reference && res.checkout_url) {
      setPaystackData({
        reference: res.reference,
        checkout_url: res.checkout_url,
        amount: res.amount || (selectedTruck.payment_plan === 'monthly' ? 3500 : 1000),
        payment_plan: selectedTruck.payment_plan || 'per_trip',
      });
      setPaystackModalOpen(true);
      window.open(res.checkout_url, '_blank', 'width=500,height=700');
    } else {
      setError(res.error || 'Failed to initiate Paystack payment');
    }
  };

  const handleVerifyAndCompleteTrip = async () => {
    if (!paystackData || !selectedTruck || !selectedSupplier) return;

    setIsSubmitting(true);
    setError(null);

    const res = await verifyTripPaymentAndCreate(
      token,
      selectedTruck.id,
      selectedSupplier.id,
      paystackData.payment_plan,
      paystackData.reference,
      getCargoPayload()
    );

    setIsSubmitting(false);

    if (res.success && res.trip) {
      setPaystackModalOpen(false);
      onTripCreated(res.trip);
    } else {
      setError(res.error || 'Payment not verified yet. Please complete the Paystack checkout.');
    }
  };

  const handleCancelPaymentModal = () => {
    setPaystackModalOpen(false);
    setPaystackData(null);
  };

  if (!isOpen) return null;

  const activeMonthlyPlan = isMonthlyActive(selectedTruck);

  return (
    <>
      <div
        id="create-trip-modal-overlay"
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn overflow-y-auto"
      >
        <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-6 max-h-[92vh]">
          
          {/* Header */}
          <div className="bg-[#0A1F44] text-white px-6 py-4 border-b border-[#15346A] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F7941D] text-[#0A1F44] flex items-center justify-center font-black shadow-md">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">Smart Dispatch & Live Customer Link</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F7941D]/20 text-[#F7941D] border border-[#F7941D]/30">
                    GPS Tracked
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  1-Step dispatch with real-time road navigation & driver assignment
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleDispatchTrip} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold">{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-[#F7941D]" />
                <span className="text-xs font-bold">Loading fleet assets and destination hubs...</span>
              </div>
            ) : (
              <>
                {/* 1. TRUCK & VEHICLE SELECTION */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-[#F7941D]" />
                      <span>1. Select Vehicle / Truck</span>
                    </label>
                    {selectedTruck && (
                      <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        Tracker: {selectedTruck.tracker_id || 'GPS Active'}
                      </span>
                    )}
                  </div>

                  {trucks.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                      No trucks registered in your fleet. Please add a truck in Asset Management first.
                    </div>
                  ) : (
                    <select
                      value={selectedTruckId}
                      onChange={(e) => handleTruckChange(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D] cursor-pointer"
                      required
                    >
                      {trucks.map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.plate_number} — {truck.model || 'Heavy Haulage'} ({truck.driver_name || 'Driver'})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* ASSIGNED DRIVER INFO (AUTO-POPULATED & EDITABLE) */}
                  {selectedTruck && (
                    <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <User className="w-3 h-3 text-[#F7941D]" />
                          <span>Assigned Driver Name</span>
                        </label>
                        <input
                          type="text"
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Driver Full Name"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D]"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#F7941D]" />
                          <span>Driver Phone (For 1-Tap Calling)</span>
                        </label>
                        <input
                          type="tel"
                          value={driverPhone}
                          onChange={(e) => setDriverPhone(e.target.value)}
                          placeholder="e.g. 08143778304"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D]"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. DESTINATION & RECEIVER */}
                <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>2. Destination Terminal / Customer Hub</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Turn-by-turn road route</span>
                  </div>

                  {suppliers.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                      No destination terminals found. Please configure a destination in Loading Hubs.
                    </div>
                  ) : (
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D] cursor-pointer"
                      required
                    >
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          📍 {s.name} ({s.state ? `${s.state} — ` : ''}{s.category || 'Terminal'})
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Customer Receiver Details (Optional) */}
                  <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Receiving Customer / Consignee (Optional)
                      </label>
                      <input
                        type="text"
                        value={customerContactName}
                        onChange={(e) => setCustomerContactName(e.target.value)}
                        placeholder="e.g. Chief Emeka / Ladipo Parts"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Customer Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={customerContactPhone}
                        onChange={(e) => setCustomerContactPhone(e.target.value)}
                        placeholder="e.g. 08031234567"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#F7941D]"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. OPTIONAL CARGO & MANIFEST DETAILS (COLLAPSIBLE) */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setShowCargoDetails(!showCargoDetails)}
                    className="w-full p-3.5 bg-slate-100/70 hover:bg-slate-100 flex items-center justify-between text-xs font-black text-slate-800 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[#F7941D]" />
                      <span>Cargo & Waybill Details ({cargoType.toUpperCase()})</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500">
                      <span>{showCargoDetails ? 'Hide' : 'Add Details (Optional)'}</span>
                      {showCargoDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {showCargoDetails && (
                    <div className="p-4 space-y-3 bg-white animate-fadeIn">
                      {/* Cargo Categories */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {CARGO_CATEGORIES.map((cat) => {
                          const IconComp = cat.icon;
                          const isSelected = cargoType === cat.id;
                          return (
                            <button
                              type="button"
                              key={cat.id}
                              onClick={() => setCargoType(cat.id)}
                              className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-orange-50 border-[#F7941D] text-[#0A1F44] ring-2 ring-[#F7941D]/30'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <IconComp className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#F7941D]' : 'text-slate-400'}`} />
                              <span className="text-[11px] font-bold truncate">{cat.name}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Waybill Number</label>
                          <input
                            type="text"
                            value={waybillNumber}
                            onChange={(e) => setWaybillNumber(e.target.value)}
                            placeholder="WB-XXXXXX"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Quantity / Volume</label>
                          <input
                            type="text"
                            value={cargoQuantity}
                            onChange={(e) => setCargoQuantity(e.target.value)}
                            placeholder="e.g. 45,000L / 900 Bags"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Security Seal #</label>
                          <input
                            type="text"
                            value={sealNumber}
                            onChange={(e) => setSealNumber(e.target.value)}
                            placeholder="e.g. SL-99201"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono font-medium text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. BILLING & DISPATCH SUMMARY */}
                <div className="p-3.5 bg-gradient-to-r from-slate-900 to-[#0A1F44] text-white rounded-2xl flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#F7941D]">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black">
                        {activeMonthlyPlan ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Monthly Unlimited Active (₦0 per-dispatch)</span>
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <span>Per-Trip Telemetry (₦1,000 via Paystack)</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300">
                        Generates instant public tracking link with turn-by-turn road route
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTON */}
                <button
                  type="submit"
                  disabled={isSubmitting || trucks.length === 0 || suppliers.length === 0}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#F7941D] to-amber-500 hover:from-amber-500 hover:to-[#F7941D] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#F7941D]/25 transition-all transform active:scale-98 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  id="dispatch-trip-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Dispatch & Linking Tracker...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>🚀 Dispatch Asset & Generate Tracking Link</span>
                    </>
                  )}
                </button>
              </>
            )}
          </form>

        </div>
      </div>

      {/* Paystack Verification Modal */}
      {paystackModalOpen && paystackData && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Complete Paystack Payment</h3>
                <p className="text-xs text-slate-500">Secure transaction via Paystack</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are paying <span className="text-[#0A1F44] font-black">₦{paystackData.amount.toLocaleString()}</span> ({paystackData.payment_plan === 'monthly' ? 'Monthly Plan' : 'Per-Trip Dispatch'}) to activate live GPS telemetry.
            </p>

            <a
              href={paystackData.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
            >
              <span>Reopen Paystack Payment Tab</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleVerifyAndCompleteTrip}
                disabled={isSubmitting}
                className="w-full bg-[#0A1F44] hover:bg-[#15346A] text-[#F7941D] font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>I have completed payment — Activate Trip</span>
              </button>

              <button
                type="button"
                onClick={handleCancelPaymentModal}
                disabled={isSubmitting}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
export default CreateTripModal;
