import React, { useState, useEffect } from 'react';
import { TruckProfile, SupplierLocation } from '../types';
import {
  getTruckProfiles,
  getSupplierLocations,
  initializeTripCreationPayment,
  verifyTripPaymentAndCreate,
  createTripDirectly,
  sendDriverDataReminderSms,
} from '../api';
import {
  X,
  Truck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Navigation,
  ShieldAlert,
  CreditCard,
  MapPin,
  Phone,
  ExternalLink,
  Wifi,
  WifiOff,
  Send,
} from 'lucide-react';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onTripCreated: (createdTrip?: any) => void;
}

export const CreateTripModal: React.FC<CreateTripModalProps> = ({
  isOpen,
  onClose,
  token,
  onTripCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [trucks, setTrucks] = useState<TruckProfile[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLocation[]>([]);

  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Driver mobile data gate state
  const [isSendingSms, setIsSendingSms] = useState<boolean>(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);
  const [showGateOfflineConfirm, setShowGateOfflineConfirm] = useState<boolean>(false);
  const [offlineConfirmedForTruckId, setOfflineConfirmedForTruckId] = useState<string | null>(null);

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
      setStep(1);
      setSelectedTruckId(null);
      setSelectedSupplierId(null);
      setError(null);
      setSmsFeedback(null);
      setShowGateOfflineConfirm(false);
      setOfflineConfirmedForTruckId(null);
      setPaystackModalOpen(false);
      setPaystackData(null);
    }
  }, [isOpen]);

  const handleSendSmsReminder = async (truck: TruckProfile) => {
    setIsSendingSms(true);
    setSmsFeedback(null);
    try {
      const res = await sendDriverDataReminderSms({
        driver_phone: truck.driver_phone,
        driver_name: truck.driver_name,
        plate_number: truck.plate_number,
        reason: 'gate_dispatch'
      }, token);

      if (res.success) {
        setSmsFeedback(`📲 SMS reminder sent to ${truck.driver_name} (${truck.driver_phone})!`);
      } else {
        setSmsFeedback(`⚠️ Could not deliver SMS: ${res.error || 'Network error'}`);
      }
    } catch (err: any) {
      setSmsFeedback(`⚠️ Failed to send SMS: ${err?.message || 'Error'}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const fetchInitialData = async () => {
    setIsLoading(true);
    setError(null);

    const [trucksRes, suppliersRes] = await Promise.all([
      getTruckProfiles(token),
      getSupplierLocations(token),
    ]);

    if (!trucksRes.success) {
      setError(trucksRes.error || 'Failed to load trucks');
    }
    if (!suppliersRes.success) {
      setError(suppliersRes.error || 'Failed to load suppliers');
    }

    setTrucks(trucksRes.trucks || []);
    setSuppliers(suppliersRes.suppliers || []);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const confirmedSuppliers = suppliers.filter((s) => s.location_confirmed);
  const unconfirmedSuppliers = suppliers.filter((s) => !s.location_confirmed);

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  // Check if monthly plan is active
  const isMonthlyActive = (truck: TruckProfile) => {
    if (truck.payment_plan === 'monthly' && truck.subscription_active_until) {
      return new Date(truck.subscription_active_until) > new Date();
    }
    return false;
  };

  const handleNextStep1 = () => {
    if (trucks.length === 0) {
      setError('Please add at least one truck before creating a trip.');
      return;
    }
    if (!selectedTruckId) {
      setError('Please select a truck to proceed.');
      return;
    }

    // Pre-Trip Data Gate: If driver is offline, require gate confirmation before dispatching
    if (selectedTruck && !selectedTruck.is_driver_online && offlineConfirmedForTruckId !== selectedTruck.id) {
      setShowGateOfflineConfirm(true);
      return;
    }

    setError(null);
    setStep(2);
  };

  const handleNextStep2 = () => {
    if (confirmedSuppliers.length === 0) {
      setError('Please confirm at least one supplier location before creating a trip.');
      return;
    }
    if (!selectedSupplierId) {
      setError('Please select a confirmed supplier destination.');
      return;
    }
    setError(null);
    setStep(3);
  };

  const handleConfirmAndPayClick = async () => {
    if (!selectedTruck || !selectedSupplierId) return;

    setIsSubmitting(true);
    setError(null);

    const plan = selectedTruck.payment_plan === 'monthly' ? 'monthly' : 'per_trip';
    const active = isMonthlyActive(selectedTruck);

    if (plan === 'monthly' && active) {
      // Monthly Active -> No payment needed, create trip directly
      const res = await createTripDirectly(token, selectedTruck.id, selectedSupplierId);
      setIsSubmitting(false);
      if (res.success) {
        onTripCreated(res.trip);
        onClose();
      } else {
        setError(res.error || 'Failed to create trip.');
      }
      return;
    }

    // Payment required (per_trip ₦1,000 or monthly expired ₦3,500)
    const initRes = await initializeTripCreationPayment(
      token,
      selectedTruck.id,
      selectedSupplierId,
      plan
    );

    setIsSubmitting(false);

    if (!initRes.success) {
      setError(initRes.error || 'Failed to initialize payment.');
      return;
    }

    if (!initRes.requires_payment) {
      // Monthly active fallback
      const res = await createTripDirectly(token, selectedTruck.id, selectedSupplierId);
      if (res.success) {
        onTripCreated(res.trip);
        onClose();
      } else {
        setError(res.error || 'Failed to create trip.');
      }
      return;
    }

    setPaystackData({
      reference: initRes.reference || '',
      checkout_url: initRes.checkout_url || '',
      amount: initRes.amount || (plan === 'monthly' ? 3500 : 1000),
      payment_plan: plan,
    });
    setPaystackModalOpen(true);
    if (initRes.checkout_url) {
      window.open(initRes.checkout_url, '_blank');
    }
  };

  const handleVerifyAndCompleteTrip = async () => {
    if (!paystackData || !selectedTruckId || !selectedSupplierId) return;

    setIsSubmitting(true);
    setError(null);

    const res = await verifyTripPaymentAndCreate(
      token,
      selectedTruckId,
      selectedSupplierId,
      paystackData.payment_plan,
      paystackData.reference
    );

    setIsSubmitting(false);
    if (res.success) {
      setPaystackModalOpen(false);
      onTripCreated(res.trip);
      onClose();
    } else {
      setError(res.error || 'Payment verification failed.');
    }
  };

  const handleCancelPaymentModal = () => {
    setPaystackModalOpen(false);
    setError('Payment was not completed. Please try again to create this trip.');
  };

  return (
    <>
      <div
        id="create-trip-modal-overlay"
        className="fixed inset-0 z-50 bg-[#070b19]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn overflow-y-auto"
      >
        <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
          
          {/* Header */}
          <div className="bg-[#070b19] px-6 py-5 border-b border-blue-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Create New Haulage Trip</h3>
                <p className="text-xs text-slate-400">Dispatch truck and activate live tracking</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#131e3d]/80 transition-colors cursor-pointer"
              id="close-create-trip-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper Wizard Bar */}
          <div className="bg-[#070b19]/60 px-6 py-3 border-b border-blue-950/60/80 flex items-center justify-between gap-2">
            
            <div className={`flex items-center gap-2 text-xs font-extrabold ${
              step === 1 ? 'text-orange-400' : step > 1 ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 1 ? 'bg-orange-500 text-slate-950 font-black' : step > 1 ? 'bg-emerald-500 text-slate-950' : 'bg-[#131e3d] text-slate-400'
              }`}>
                {step > 1 ? <CheckCircle2 className="w-4 h-4 stroke-[3]" /> : '1'}
              </div>
              <span>1. Select Truck</span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-700 shrink-0" />

            <div className={`flex items-center gap-2 text-xs font-extrabold ${
              step === 2 ? 'text-orange-400' : step > 2 ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 2 ? 'bg-orange-500 text-slate-950 font-black' : step > 2 ? 'bg-emerald-500 text-slate-950' : 'bg-[#131e3d] text-slate-400'
              }`}>
                {step > 2 ? <CheckCircle2 className="w-4 h-4 stroke-[3]" /> : '2'}
              </div>
              <span>2. Supplier Destination</span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-700 shrink-0" />

            <div className={`flex items-center gap-2 text-xs font-extrabold ${
              step === 3 ? 'text-orange-400' : 'text-slate-500'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                step === 3 ? 'bg-orange-500 text-slate-950 font-black' : 'bg-[#131e3d] text-slate-400'
              }`}>
                3
              </div>
              <span>3. Review & Pay</span>
            </div>

          </div>

          {/* Global Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <p className="text-xs font-bold">Loading available fleet trucks and suppliers...</p>
              </div>
            ) : (
              <>
                {/* STEP 1: SELECT TRUCK */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-white">Choose a Truck for this Trip</h4>
                      <span className="text-xs text-slate-400 font-medium">{trucks.length} registered trucks</span>
                    </div>

                    {trucks.length === 0 ? (
                      <div className="p-8 text-center bg-[#070b19]/60 border border-orange-500/30 rounded-2xl space-y-3">
                        <ShieldAlert className="w-8 h-8 text-orange-400 mx-auto" />
                        <p className="text-sm font-bold text-orange-300">No registered trucks found</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Please add at least one truck profile under the "Truck Profiles & Payment Plans" tab before dispatching a trip.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {trucks.map((truck) => {
                          const isSelected = selectedTruckId === truck.id;
                          const active = isMonthlyActive(truck);

                          return (
                            <div
                              key={truck.id}
                              onClick={() => {
                                setSelectedTruckId(truck.id);
                                setError(null);
                              }}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                isSelected
                                  ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10'
                                  : 'bg-[#070b19] border-blue-950/60 hover:border-blue-900/65'
                              }`}
                              id={`select-truck-card-${truck.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                    isSelected ? 'bg-orange-500 text-slate-950 font-black' : 'bg-[#131e3d] text-slate-400'
                                  }`}>
                                    <Truck className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className="font-black text-sm text-white tracking-wide">{truck.plate_number}</div>
                                    <div className="text-xs text-slate-300 font-medium">{truck.driver_name}</div>
                                  </div>
                                </div>

                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-orange-500 bg-orange-500 text-slate-950' : 'border-blue-900/65'
                                }`}>
                                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>

                              {/* Payment Plan Badge & Driver Online Status */}
                              <div className="pt-2 border-t border-blue-950/60/80 flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-500" />
                                    <span>{truck.driver_phone}</span>
                                  </span>

                                  {truck.is_driver_online ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      <span>Data ON</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-md">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                      <span>Data OFF</span>
                                    </span>
                                  )}
                                </div>

                                {truck.payment_plan === 'monthly' ? (
                                  active ? (
                                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>✅ Monthly Plan Active until {new Date(truck.subscription_active_until!).toLocaleDateString()} — No payment needed</span>
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>⚠️ Monthly plan expired — ₦3,500 renewal required</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    <span>₦1,000 will be charged to create this trip</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pre-Trip Gate Warning: Driver Mobile Data is OFF */}
                    {selectedTruck && !selectedTruck.is_driver_online && (
                      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-orange-500/15 via-rose-500/10 to-orange-500/15 border-2 border-orange-500/40 text-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                            <WifiOff className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-sm text-white flex items-center gap-2">
                              <span>⚠️ Gate Alert: Driver Mobile Data is OFF</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {selectedTruck.driver_last_seen || 'Offline'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                              Driver <strong className="text-white">{selectedTruck.driver_name}</strong> is currently not transmitting internet signals. Instruct him at the garage gate to turn ON Mobile Data before driving off.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSendSmsReminder(selectedTruck)}
                          disabled={isSendingSms}
                          className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md self-start sm:self-center"
                          id="send-driver-gate-sms-btn"
                        >
                          {isSendingSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{isSendingSms ? 'Sending SMS...' : 'Send SMS to Driver'}</span>
                        </button>
                      </div>
                    )}

                    {/* Feedback pill after sending SMS */}
                    {smsFeedback && (
                      <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{smsFeedback}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: SELECT SUPPLIER DESTINATION */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-extrabold text-white">Select Confirmed Supplier Destination</h4>
                      <span className="text-xs text-slate-400 font-medium">
                        {confirmedSuppliers.length} confirmed available
                      </span>
                    </div>

                    {confirmedSuppliers.length === 0 ? (
                      <div className="p-8 text-center bg-[#070b19]/60 border border-orange-500/30 rounded-2xl space-y-3">
                        <ShieldAlert className="w-8 h-8 text-orange-400 mx-auto" />
                        <p className="text-sm font-bold text-orange-300">No confirmed suppliers available</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Please confirm at least one supplier location first before creating a trip.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {confirmedSuppliers.map((supplier) => {
                          const isSelected = selectedSupplierId === supplier.id;

                          return (
                            <div
                              key={supplier.id}
                              onClick={() => {
                                setSelectedSupplierId(supplier.id);
                                setError(null);
                              }}
                              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-orange-500/10 border-orange-500 shadow-lg shadow-orange-500/10'
                                  : 'bg-[#070b19] border-blue-950/60 hover:border-blue-900/65'
                              }`}
                              id={`select-supplier-card-${supplier.id}`}
                            >
                              <div className="flex items-start gap-3.5">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                                  isSelected ? 'bg-orange-500 text-slate-950 font-black' : 'bg-[#131e3d] text-slate-400'
                                }`}>
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-extrabold text-sm text-white">{supplier.name}</span>
                                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Confirmed 🟢</span>
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                    <span>{supplier.address_text}</span>
                                  </p>
                                </div>
                              </div>

                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? 'border-orange-500 bg-orange-500 text-slate-950' : 'border-blue-900/65'
                              }`}>
                                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}

                        {unconfirmedSuppliers.length > 0 && (
                          <div className="pt-4 border-t border-blue-950/60/80 space-y-2">
                            <p className="text-xs font-bold text-slate-500">Unconfirmed Suppliers (Not selectable):</p>
                            {unconfirmedSuppliers.map((supplier) => (
                              <div
                                key={supplier.id}
                                className="p-3.5 rounded-2xl bg-[#070b19]/40 border border-blue-950/60/60 opacity-50 flex items-center justify-between gap-3 cursor-not-allowed"
                              >
                                <div className="flex items-center gap-3">
                                  <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                                  <div>
                                    <span className="font-bold text-xs text-slate-400">{supplier.name}</span>
                                    <p className="text-[11px] text-slate-500 truncate">{supplier.address_text}</p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-orange-500/80 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20 whitespace-nowrap">
                                  🟡 Location Pending
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: REVIEW & CONFIRM */}
                {step === 3 && selectedTruck && selectedSupplier && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-extrabold text-white">Review Trip Summary & Confirm Payment</h4>

                    <div className="bg-[#070b19] border border-blue-950/60 rounded-2xl p-5 space-y-4">
                      
                      {/* Truck Details */}
                      <div className="flex items-start gap-4 pb-4 border-b border-blue-950/60">
                        <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Assigned Truck & Driver</span>
                          <div className="font-black text-base text-white mt-0.5">{selectedTruck.plate_number}</div>
                          <p className="text-xs text-slate-300 font-medium">Driver: {selectedTruck.driver_name} ({selectedTruck.driver_phone})</p>
                        </div>
                      </div>

                      {/* Destination Details */}
                      <div className="flex items-start gap-4 pb-4 border-b border-blue-950/60">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Primary Supplier Destination</span>
                          <div className="font-black text-base text-white mt-0.5">{selectedSupplier.name}</div>
                          <p className="text-xs text-slate-300 font-medium mt-0.5">{selectedSupplier.address_text}</p>
                        </div>
                      </div>

                      {/* Payment Due Summary */}
                      <div className="flex items-start gap-4 pb-4 border-b border-blue-950/60">
                        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Payment & Plan Status</span>
                          <div className="font-black text-base text-white mt-0.5">
                            {selectedTruck.payment_plan === 'monthly' ? (
                              isMonthlyActive(selectedTruck) ? (
                                <span className="text-emerald-400">Monthly Plan Active — No Payment Needed</span>
                              ) : (
                                <span className="text-orange-400">Monthly Renewal Required — ₦3,500</span>
                              )
                            ) : (
                              <span className="text-blue-400">Per Trip Charge — ₦1,000</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {selectedTruck.payment_plan === 'monthly' && isMonthlyActive(selectedTruck)
                              ? 'Your active monthly subscription covers this trip completely.'
                              : selectedTruck.payment_plan === 'monthly'
                              ? 'Renewing covers all trips for this truck for the next 30 days.'
                              : 'Payment is required to activate live tracking for this trip.'}
                          </p>
                        </div>
                      </div>

                      {/* Driver Mobile Data / Gate Status */}
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                          selectedTruck.is_driver_online
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                        }`}>
                          {selectedTruck.is_driver_online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Driver Phone / Gate Clearance</span>
                          <div className="font-black text-sm text-white mt-0.5 flex items-center gap-2">
                            {selectedTruck.is_driver_online ? (
                              <span className="text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>🟢 Mobile Data ON — Ready for live tracking</span>
                              </span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>🔴 Mobile Data OFF — Driver must turn ON data at the gate</span>
                              </span>
                            )}
                          </div>
                          {!selectedTruck.is_driver_online && (
                            <p className="text-xs text-orange-300/90 mt-1">
                              ⚠️ Warning: Since mobile data is off, the app will store coordinates locally (offline black box) until data is restored. Confirm driver turns on data before leaving the gate.
                            </p>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          <div className="bg-[#070b19] px-6 py-4 border-t border-blue-950/60 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as any)}
                disabled={isSubmitting}
                className="bg-[#131e3d] hover:bg-slate-700 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="bg-[#131e3d] hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={step === 1 ? handleNextStep1 : handleNextStep2}
                disabled={isLoading || (step === 1 && !selectedTruckId) || (step === 2 && !selectedSupplierId)}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-orange-500/20 cursor-pointer"
              >
                <span>Next Step</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirmAndPayClick}
                disabled={isSubmitting || !selectedTruck}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
                id="confirm-create-trip-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : selectedTruck?.payment_plan === 'monthly' && isMonthlyActive(selectedTruck) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    <span>Create Trip — No Payment Needed</span>
                  </>
                ) : selectedTruck?.payment_plan === 'monthly' ? (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Renew Monthly Plan & Create Trip — ₦3,500</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Create Trip & Pay ₦1,000</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Paystack Checkout Modal Overlay */}
      {paystackModalOpen && paystackData && (
        <div className="fixed inset-0 z-65 bg-[#070b19]/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1329] border border-blue-950/60 rounded-3xl max-w-md w-full shadow-2xl p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
              <CreditCard className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Complete Paystack Payment</h3>
              <p className="text-xs text-slate-300">
                You are paying <span className="text-emerald-400 font-black">₦{paystackData.amount.toLocaleString()}</span> ({paystackData.payment_plan === 'monthly' ? 'Monthly Plan Subscription' : 'Per Trip Haulage Fee'}) to activate live tracking.
              </p>
              <p className="text-[11px] text-slate-500 font-mono">Reference: {paystackData.reference}</p>
            </div>

            <div className="bg-[#070b19] p-4 rounded-2xl border border-blue-950/60 text-left space-y-2">
              <p className="text-xs text-slate-400 font-medium">
                1. If the Paystack checkout window didn't open automatically, click below:
              </p>
              <a
                href={paystackData.checkout_url}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#131e3d] hover:bg-slate-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <span>Open Paystack Checkout Portal</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleVerifyAndCompleteTrip}
                disabled={isSubmitting}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying & Creating Trip...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                    <span>Confirm Payment Success & Create Trip</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelPaymentModal}
                disabled={isSubmitting}
                className="w-full bg-[#131e3d] hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Cancel / Close (Do Not Create Trip)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gate Offline Confirmation Modal */}
      {showGateOfflineConfirm && selectedTruck && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border-2 border-orange-500/60 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
                <WifiOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Gate Warning: Driver Data is OFF</h3>
                <p className="text-xs text-orange-400/90 font-medium">Verify before truck departs garage gate</p>
              </div>
            </div>

            <div className="bg-[#070b19] p-4 rounded-2xl border border-blue-950/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Truck / Plate:</span>
                <span className="font-extrabold text-white">{selectedTruck.plate_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Name:</span>
                <span className="font-extrabold text-white">{selectedTruck.driver_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-bold text-slate-300">{selectedTruck.driver_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Data Status:</span>
                <span className="font-black text-rose-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>OFFLINE ({selectedTruck.driver_last_seen || 'No ping'})</span>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Driver <strong>{selectedTruck.driver_name}</strong> is currently not transmitting internet data. If you dispatch now, real-time live map tracking will not be visible until he switches on mobile data.
            </p>

            {/* Quick SMS Trigger */}
            <button
              type="button"
              onClick={() => handleSendSmsReminder(selectedTruck)}
              disabled={isSendingSms}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-500/15 border border-orange-500/40 hover:bg-orange-500/25 text-orange-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {isSendingSms ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSendingSms ? 'Sending SMS Reminder...' : 'Send "Turn ON Data" SMS to Driver'}</span>
            </button>

            {smsFeedback && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{smsFeedback}</span>
              </div>
            )}

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setOfflineConfirmedForTruckId(selectedTruck.id);
                  setShowGateOfflineConfirm(false);
                  setError(null);
                  setStep(2);
                }}
                className="w-full bg-orange-500 hover:bg-orange-400 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 cursor-pointer transition-colors"
                id="gate-confirm-proceed-btn"
              >
                <span>Proceed (Driver Instructed at Gate)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowGateOfflineConfirm(false)}
                className="w-full bg-[#131e3d] hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
              >
                Wait / Go Back to Truck Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
