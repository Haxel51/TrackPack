import React, { useState, useEffect } from 'react';
import { getAvailableBuses, createWaybill, getStaffCompanyParks } from '../../lib/api';
import { Bus } from '../../types';
import { FileText, ArrowLeft, Loader2, Plus, Sparkles, CheckCircle, ExternalLink, CreditCard, CheckCircle2 } from 'lucide-react';

interface WaybillFormProps {
  token: string;
  originPark: string;
  onBackToMenu: () => void;
  onCreateNewBus: () => void;
}

export const WaybillForm: React.FC<WaybillFormProps> = ({ token, originPark, onBackToMenu, onCreateNewBus }) => {
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [busId, setBusId] = useState('Unassigned');
  const [destinationPark, setDestinationPark] = useState('');

  const [parks, setParks] = useState<{ id: string; park_name: string; park_location: string }[]>([]);
  const [availableBuses, setAvailableBuses] = useState<Bus[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Success tracking state
  const [createdTrackingCode, setCreatedTrackingCode] = useState<string | null>(null);

  // Stage 6: Paystack Active Payment state
  const [activePayment, setActivePayment] = useState<{
    paymentId: string;
    waybillId: string;
    accountNumber: string;
    bankName: string;
    expiresAt: string;
    amount: number;
    checkoutUrl?: string | null;
    verifying: boolean;
    success: boolean;
    trackingCode: string | null;
  } | null>(null);

  // Timer countdown helper
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  useEffect(() => {
    if (!activePayment || activePayment.success) return;
    const expiry = new Date(activePayment.expiresAt).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activePayment]);

  // Automated polling of payment status
  useEffect(() => {
    if (!activePayment || activePayment.success) return;

    const poll = async () => {
      try {
        const response = await fetch(`/api/staff/payments/${activePayment.paymentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.payment && data.payment.status === "success") {
            setActivePayment(prev => prev ? {
              ...prev,
              success: true,
              trackingCode: data.tracking_code
            } : null);
          }
        }
      } catch (err) {
        console.error("Auto polling error:", err);
      }
    };

    const pollInterval = setInterval(poll, 4000);
    return () => clearInterval(pollInterval);
  }, [activePayment, token]);

  const fetchMetadata = async () => {
    setLoadingData(true);
    try {
      const [busesRes, parksRes] = await Promise.all([
        getAvailableBuses(token),
        getStaffCompanyParks(token)
      ]);

      if (parksRes.success && parksRes.parks) {
        const filteredParks = parksRes.parks.filter((p: any) => p.park_location !== originPark);
        setParks(filteredParks);
        if (filteredParks.length > 0) {
          setDestinationPark(filteredParks[0].park_location);
        }
      }

      if (busesRes.success && busesRes.buses) {
        setAvailableBuses(busesRes.buses);
      }
    } catch (err) {
      console.error('Error fetching waybill metadata:', err);
      setError('Failed to load park locations and active buses.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  const handleDestinationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dest = e.target.value;
    setDestinationPark(dest);
    setBusId('Unassigned'); // Reset bus choice when destination changes
  };

  const handleBusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBusId(e.target.value);
  };

  const handleReset = () => {
    setSenderName('');
    setSenderPhone('');
    setReceiverName('');
    setReceiverPhone('');
    setItemDescription('');
    setCreatedTrackingCode(null);
    setActivePayment(null);
    setError(null);
    setBusId('Unassigned');
    fetchMetadata();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderPhone.trim() || !receiverName.trim() || !receiverPhone.trim() || !itemDescription.trim() || !destinationPark.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    const cleanSender = senderPhone.replace(/\D/g, '');
    if (cleanSender.length !== 11) {
      setError('Sender phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    const cleanReceiver = receiverPhone.replace(/\D/g, '');
    if (cleanReceiver.length !== 11) {
      setError('Receiver phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    setSubmitLoading(true);
    setError(null);

    try {
      const res = await createWaybill(token, {
        sender_name: senderName.trim(),
        sender_phone: senderPhone.trim(),
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim(),
        item_description: itemDescription.trim(),
        bus_id: busId === 'Unassigned' ? '' : busId,
        destination_park: destinationPark.trim()
      });

      if (res.success && res.waybill && res.payment) {
        // Switch to the Paystack transfer details screen
        setActivePayment({
          paymentId: res.payment.id,
          waybillId: res.waybill.id,
          accountNumber: res.payment.virtual_account_number,
          bankName: res.payment.virtual_account_bank,
          expiresAt: res.payment.virtual_account_expires_at,
          amount: res.payment.amount,
          checkoutUrl: res.payment.checkout_url || null,
          verifying: false,
          success: false,
          trackingCode: null
        });
      } else {
        setError(res.error || 'Failed to create waybill. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please check connection and try again.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Stage 6: Manually verify transfer / trigger poll
  const handleManualVerify = async () => {
    if (!activePayment) return;
    setActivePayment(prev => prev ? { ...prev, verifying: true } : null);
    setError(null);
    try {
      const response = await fetch(`/api/staff/payments/${activePayment.paymentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        if (data.payment.status === "success") {
          setActivePayment(prev => prev ? {
            ...prev,
            success: true,
            verifying: false,
            trackingCode: data.tracking_code
          } : null);
        } else {
          setError("Transfer not detected yet. Please make sure you have sent the transfer and try again.");
          setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
        }
      } else {
        setError(data.error || "Failed to check transfer status.");
        setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to the server.");
      setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
    }
  };

  // Stage 6: Retry payment to get a fresh virtual account details
  const handleRetryPayment = async () => {
    if (!activePayment) return;
    setActivePayment(prev => prev ? { ...prev, verifying: true } : null);
    setError(null);
    try {
      const response = await fetch(`/api/staff/waybills/${activePayment.waybillId}/retry-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data.success && data.payment) {
        setActivePayment({
          paymentId: data.payment.id,
          waybillId: activePayment.waybillId,
          accountNumber: data.payment.virtual_account_number,
          bankName: data.payment.virtual_account_bank,
          expiresAt: data.payment.virtual_account_expires_at,
          amount: data.payment.amount,
          checkoutUrl: data.payment.checkout_url || null,
          verifying: false,
          success: false,
          trackingCode: null
        });
      } else {
        setError(data.error || "Failed to regenerate payment details.");
        setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to server.");
      setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
    }
  };

  // Stage 6: Simulate payment success instantly
  const handleSimulatePayment = async () => {
    if (!activePayment) return;
    setActivePayment(prev => prev ? { ...prev, verifying: true } : null);
    setError(null);
    try {
      const response = await fetch(`/api/staff/payments/${activePayment.paymentId}/verify-sim`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setActivePayment(prev => prev ? {
          ...prev,
          success: true,
          verifying: false,
          trackingCode: data.tracking_code
        } : null);
      } else {
        setError(data.error || "Failed to simulate payment.");
        setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to simulate payment.");
      setActivePayment(prev => prev ? { ...prev, verifying: false } : null);
    }
  };

  // Stage 6: Main active payment checkout UI block
  if (activePayment) {
    const isExpired = timeLeft === 0;

    if (activePayment.success) {
      return (
        <div className="max-w-md mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl text-center space-y-6" id="waybill-success-screen">
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
              Payment Confirmed & Approved
            </span>
            <h2 className="text-xl font-extrabold text-[#0A1F44] pt-2">Waybill Registered Successfully</h2>
            <p className="text-sm text-slate-500">Share or copy this tracking code with the customer</p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 select-all cursor-pointer hover:bg-slate-100 transition-colors">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">Tracking Code</span>
            <div className="text-3xl font-black text-[#0A1F44] tracking-wider mt-1">
              {activePayment.trackingCode}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <button
              onClick={handleReset}
              className="w-full bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
              id="success-another-btn"
            >
              Create Another Waybill
            </button>
            <button
              onClick={onBackToMenu}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer"
              id="success-menu-btn"
            >
              Back to Main Menu
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl space-y-6" id="paystack-transfer-checkout">
        <div className="text-center space-y-2">
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            Awaiting Tracking Payment
          </span>
          <h2 className="text-xl font-black text-[#0A1F44]">Collect ₦{activePayment.amount} Tracking Fee</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Please direct the customer to complete their ₦{activePayment.amount} booking payment via Paystack below.
          </p>
        </div>

        {/* Serious Warning Card */}
        <div className="bg-rose-50 border-2 border-rose-500 rounded-2xl p-4.5 space-y-3 text-rose-950 shadow-xs" id="critical-security-warning">
          <div className="flex items-center gap-1.5 font-black text-xs text-rose-800 uppercase tracking-wider">
            <span>⚠️ CRITICAL SECURITY WARNING</span>
          </div>
          <div className="space-y-2.5 text-[11px] font-bold leading-relaxed text-left text-rose-900">
            <p>
              <strong className="text-rose-700 underline uppercase tracking-wide">Rule 1: No Direct Bank Transfers</strong> — 
              NEVER pay or transfer money to any individual bank account details. TrackPack will NOT refund or assist you if you pay into any external or manual bank account. All payments must be processed strictly online through the secure Paystack portal by clicking the button below.
            </p>
            <div className="h-px bg-rose-200" />
            <p>
              <strong className="text-rose-700 underline uppercase tracking-wide">Rule 2: One-Time Payment Only</strong> — 
              NEVER save the Paystack account details or attempt to transfer to them again. This is a secure <strong className="text-rose-700 font-extrabold">PAY-ONCE (1-TIME)</strong> dynamic checkout. Re-using previous details or sending subsequent transfers is highly prohibited and will result in lost funds that cannot be refunded or resolved.
            </p>
          </div>
        </div>

        {/* Secure Checkout details card */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Payment Partner</span>
              <span className="text-[#0A1F44] font-extrabold text-sm">Paystack</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Transaction Mode</span>
              <span className="text-[#0A1F44] font-extrabold text-sm">Live Checkout Gateway</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Amount Due</span>
              <span className="text-[#0A1F44] font-extrabold text-sm">₦{activePayment.amount}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block uppercase tracking-wider text-[10px]">Recipient Name</span>
              <span className="text-slate-600 font-semibold block text-[11px]">TrackPack / Paystack</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 text-center">
            {isExpired ? (
              <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 block">
                Checkout URL Expired
              </span>
            ) : (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-semibold">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                <span>Session expires in: <strong>{Math.floor(timeLeft / 60)}m {timeLeft % 60}s</strong></span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-100 text-center">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {activePayment.checkoutUrl && !isExpired && (
            <a
              href={activePayment.checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#0A1F44] hover:bg-slate-800 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 no-underline shadow-md"
              id="paystack-checkout-link"
            >
              <ExternalLink className="w-4 h-4 text-[#F2A93B]" />
              <span>Open Paystack Live Checkout Portal</span>
            </a>
          )}

          {!isExpired ? (
            <button
              onClick={handleManualVerify}
              disabled={activePayment.verifying}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-45 text-white font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all border-0 shadow-sm cursor-pointer"
              id="verify-transfer-btn"
            >
              {activePayment.verifying ? "Checking status..." : "Confirm Paystack Payment Success"}
            </button>
          ) : (
            <button
              onClick={handleRetryPayment}
              disabled={activePayment.verifying}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all border-0 cursor-pointer"
              id="retry-payment-btn"
            >
              {activePayment.verifying ? "Regenerating..." : "Regenerate Checkout Details"}
            </button>
          )}

          <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
            <button
              onClick={handleReset}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold py-3 rounded-xl text-xs transition-colors border border-slate-200 cursor-pointer"
              id="cancel-payment-btn"
            >
              Cancel Booking
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-3xl p-8 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={onBackToMenu}
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-extrabold text-[#0A1F44] flex items-center gap-2">
            <FileText className="text-[#F2A93B] w-5 h-5" />
            Create New Waybill
          </h2>
          <p className="text-xs text-slate-500">Record outgoing parcel shipment details and dispatch route</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {loadingData ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-sm">Fetching locations and active bus manifests...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Origin Park (Current Terminal)
              </label>
              <input
                type="text"
                value={originPark}
                disabled
                className="w-full bg-slate-50 text-slate-500 border border-slate-200 rounded-xl px-4 py-3 text-sm cursor-not-allowed font-medium focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#0A1F44] uppercase tracking-wider mb-2">
                Select Destination Park <span className="text-red-500">*</span>
              </label>
              {parks.length === 0 ? (
                <div className="text-xs text-red-500 py-2">
                  No other parks registered for your company. Please configure parks in the Admin Partner portal first.
                </div>
              ) : (
                <select
                  value={destinationPark}
                  onChange={handleDestinationChange}
                  className="w-full bg-white border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                >
                  {parks.map((p, idx) => (
                    <option key={`park-opt-${p.id || idx}-${idx}`} value={p.park_location}>
                      {p.park_name} ({p.park_location})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Optional Bus Selection Card */}
          <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-5" id="bus-assignment-card">
            <div className="flex justify-between items-center mb-3">
              <label className="text-xs font-bold text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F2A93B]" />
                Assign to Driver / Bus (Optional)
              </label>
              <button
                type="button"
                onClick={onCreateNewBus}
                className="text-xs text-blue-700 hover:text-blue-900 font-extrabold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Register New Bus
              </button>
            </div>
            
            <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
              If there is an active bus loading for <strong className="text-[#0A1F44] font-extrabold">{destinationPark || "the selected destination"}</strong>, you can assign it now. Or choose <span className="font-semibold text-blue-700">Leave Unassigned</span> to register it on a driver/manifest later.
            </p>

            <select
              value={busId}
              onChange={handleBusChange}
              className="w-full bg-white border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
            >
              <option value="Unassigned">-- Leave Unassigned (Assign to driver/bus later) --</option>
              {availableBuses
                .filter(b => b.destination_park === destinationPark)
                .map((bus, index) => (
                  <option key={`bus-opt-${bus.id || index}-${index}`} value={bus.id}>
                    Bus {bus.bus_number} &rarr; {bus.destination_park} (Driver: {bus.driver_name || 'N/A'})
                  </option>
                ))}
            </select>

            {availableBuses.filter(b => b.destination_park === destinationPark).length === 0 && destinationPark && (
              <p className="text-[10px] text-amber-700 font-semibold mt-2.5 bg-amber-50 border border-amber-100 p-2.5 rounded-lg flex items-center gap-1.5">
                💡 Tip: No active buses currently loading for {destinationPark}. This waybill will be registered as unassigned. You can load it onto a bus later.
              </p>
            )}
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-extrabold text-[#0A1F44] mb-4 text-sm uppercase tracking-wide">Sender Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sender Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Obi"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sender Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={11}
                  placeholder="e.g. 08031112222"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="font-extrabold text-[#0A1F44] mb-4 text-sm uppercase tracking-wide">Receiver Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Receiver Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mary Obi"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Receiver Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  maxLength={11}
                  placeholder="e.g. 08032223333"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Item Description / Contents <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Carton of vehicle spare parts (filters & brakepads)"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                className="w-full border border-slate-200 focus:border-[#0A1F44] rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onBackToMenu}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer text-center"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitLoading}
              className="flex-1 bg-[#0A1F44] hover:bg-blue-900 text-white font-bold py-3.5 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {submitLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Create Waybill'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
