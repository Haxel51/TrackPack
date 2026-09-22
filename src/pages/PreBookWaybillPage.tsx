import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  MapPin,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Truck,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkles,
  QrCode,
  Tag,
  CreditCard,
  Banknote
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { WaybillBarcodePass, WaybillPassData } from '../components/WaybillBarcodePass';
import { useAuth } from '../context/AuthContext';

interface Company {
  id: string;
  company_name: string;
  city?: string;
  state?: string;
  phone?: string;
}

interface Park {
  id?: string;
  park_name: string;
  park_location?: string;
  city?: string;
  state?: string;
  company_id?: string;
}

export const PreBookWaybillPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lists from backend
  const [companies, setCompanies] = useState<Company[]>([]);
  const [parks, setParks] = useState<Park[]>([]);

  // Form State
  const [originPark, setOriginPark] = useState('');
  const [destinationPark, setDestinationPark] = useState('');
  const [customDestination, setCustomDestination] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [serviceMode, setServiceMode] = useState<'parcel' | 'haulage' | 'express'>('parcel');

  // Sender & Receiver
  const [senderName, setSenderName] = useState(user?.name || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone_number || user?.phone || '');
  const [senderEmail, setSenderEmail] = useState(user?.email || '');

  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');

  // Parcel details
  const [itemCategory, setItemCategory] = useState('General Goods');
  const [itemDescription, setItemDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [weightKg, setWeightKg] = useState(2);
  const [declaredValue, setDeclaredValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pay_at_counter' | 'online_card'>('pay_at_counter');

  // Success Result Pass
  const [passData, setPassData] = useState<WaybillPassData | null>(null);

  useEffect(() => {
    fetchParksAndCompanies();
  }, []);

  const fetchParksAndCompanies = async () => {
    setDataLoading(true);
    try {
      const res = await fetch('/api/public/parks-and-companies');
      const data = await res.json();
      if (data.success) {
        setCompanies(data.companies || []);
        const allParks = [
          ...(data.registered_parks || []),
          ...(data.popular_parks || [])
        ];
        // Deduplicate by park_name
        const uniqueParks: Park[] = [];
        const seen = new Set<string>();
        for (const p of allParks) {
          const name = p.park_name || p.park_location;
          if (name && !seen.has(name)) {
            seen.add(name);
            uniqueParks.push(p);
          }
        }
        setParks(uniqueParks);
      }
    } catch (err) {
      console.error('Error loading parks/companies:', err);
    } finally {
      setDataLoading(false);
    }
  };

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!originPark.trim()) {
      setError('Please select the departure motor park where you will drop off the parcel.');
      return;
    }
    const finalDest = destinationPark === 'OTHER' ? customDestination.trim() : destinationPark.trim();
    if (!finalDest) {
      setError('Please select or specify the destination motor park / town.');
      return;
    }
    if (originPark.trim().toLowerCase() === finalDest.toLowerCase()) {
      setError('Departure park and Destination park cannot be the exact same location.');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) {
      setError('Sender full name is required.');
      return;
    }
    const cleanSPhone = senderPhone.trim().replace(/[\s-]/g, '');
    if (!/^[0-9]{11}$/.test(cleanSPhone)) {
      setError('Sender phone must be a valid 11-digit Nigerian number (e.g. 08012345678).');
      return;
    }

    if (!receiverName.trim()) {
      setError('Receiver full name is required.');
      return;
    }
    const cleanRPhone = receiverPhone.trim().replace(/[\s-]/g, '');
    if (!/^[0-9]{11}$/.test(cleanRPhone)) {
      setError('Receiver phone must be a valid 11-digit Nigerian number (e.g. 08012345678).');
      return;
    }

    setError(null);
    setStep(3);
  };

  const handleNextStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemDescription.trim()) {
      setError('Please describe the goods/package being sent.');
      return;
    }
    setError(null);
    setStep(4);
  };

  const handleSubmitBooking = async () => {
    setLoading(true);
    setError(null);
    try {
      const finalDest = destinationPark === 'OTHER' ? customDestination.trim() : destinationPark.trim();
      const payload = {
        sender_name: senderName.trim(),
        sender_phone: senderPhone.trim().replace(/[\s-]/g, ''),
        sender_email: senderEmail.trim(),
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim().replace(/[\s-]/g, ''),
        receiver_address: receiverAddress.trim(),
        origin_park: originPark.trim(),
        destination_park: finalDest,
        company_id: companyId || undefined,
        company_name: companyName || undefined,
        item_description: itemDescription.trim(),
        item_category: itemCategory,
        quantity: Math.max(1, Number(quantity) || 1),
        weight_kg: Math.max(1, Number(weightKg) || 1),
        declared_value: declaredValue ? Number(declaredValue) : undefined,
        service_mode: serviceMode,
        payment_method: paymentMethod,
        customer_id: user?.id || undefined
      };

      const res = await fetch('/api/waybills/pre-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit pre-booking. Please try again.');
      }

      setPassData(data.pass || {
        tracking_code: data.tracking_code,
        sender_name: senderName,
        sender_phone: senderPhone,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        origin_park: originPark,
        destination_park: finalDest,
        item_description: itemDescription,
        quantity: quantity,
        pickup_code: data.pickup_pin,
        estimated_fee: 1600,
        company_name: companyName || 'Waybilla Motor Park Partner'
      });
      setStep(5);
    } catch (err: any) {
      console.error('Error submitting pre-booking:', err);
      setError(err.message || 'Network error submitting waybill pre-booking.');
    } finally {
      setLoading(false);
    }
  };

  // Estimate Calculation
  const estimatedFee = 1500 + (quantity > 1 ? (quantity - 1) * 500 : 0) + (weightKg > 5 ? (weightKg - 5) * 200 : 0) + 100;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-[#0A1F44] text-white border-b-2 border-[#F7941D]/40 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <Logo size="sm" showText={false} />
            <div className="flex items-center gap-0.5 font-black text-lg sm:text-xl tracking-tight">
              <span>Way<span className="text-[#F7941D]">billa</span></span>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            <Link
              to="/"
              className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800/80 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all whitespace-nowrap"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-grow space-y-6">
        {step < 5 && (
          <div className="space-y-2 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[#0A1F44] text-xs font-black">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span>Self-Service Parcel Pre-Booking</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A1F44]">
              Send a Parcel Across Nigeria
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xl">
              Book at home or office. Receive an instant <strong>QR Pass &amp; Tracking Code</strong> to show counter staff for 2-second express intake at the park!
            </p>

            {/* Stepper Header */}
            <div className="flex items-center justify-between pt-4 max-w-md mx-auto sm:mx-0">
              {[
                { num: 1, label: 'Route' },
                { num: 2, label: 'Contacts' },
                { num: 3, label: 'Parcel' },
                { num: 4, label: 'Review' }
              ].map((s, idx) => (
                <div key={s.num} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all ${
                      step === s.num
                        ? 'bg-[#0A1F44] text-white ring-4 ring-[#0A1F44]/15'
                        : step > s.num
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-xs font-extrabold hidden sm:inline ${step === s.num ? 'text-[#0A1F44]' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                  {idx < 3 && <div className="w-6 sm:w-8 h-0.5 bg-slate-200"></div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* STEP 1: ROUTE & SERVICE SELECTION */}
        {step === 1 && (
          <form onSubmit={handleNextStep1} className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" /> Step 1: Select Route &amp; Motor Park
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Choose the motor park you will drop your goods at, and the destination city.
              </p>
            </div>

            <div className="space-y-4">
              {/* Departure Park */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 block">
                  Departure Motor Park (Drop-Off Station) *
                </label>
                <select
                  value={originPark}
                  onChange={(e) => {
                    const newOrigin = e.target.value;
                    setOriginPark(newOrigin);
                    if (destinationPark && destinationPark.toLowerCase() === newOrigin.toLowerCase()) {
                      setDestinationPark('');
                      setError(null);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0A1F44] rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-800 outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="">-- Choose Origin Park --</option>
                  {parks.map((p, idx) => {
                    const name = p.park_name || p.park_location;
                    return (
                      <option key={idx} value={name}>
                        {name} {p.city ? `(${p.city})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Destination Park */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 block">
                  Destination Motor Park / City *
                </label>
                <select
                  value={destinationPark}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDestinationPark(val);
                    if (originPark && val.toLowerCase() === originPark.toLowerCase()) {
                      setError('Departure park and Destination park cannot be the exact same location.');
                    } else {
                      setError(null);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0A1F44] rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-800 outline-none transition-all cursor-pointer"
                  required
                >
                  <option value="">-- Choose Destination Park / City --</option>
                  {parks
                    .filter((p) => {
                      const name = (p.park_name || p.park_location || '').trim().toLowerCase();
                      const origin = originPark.trim().toLowerCase();
                      return !origin || name !== origin;
                    })
                    .map((p, idx) => {
                      const name = p.park_name || p.park_location;
                      return (
                        <option key={idx} value={name}>
                          {name} {p.city ? `(${p.city})` : ''}
                        </option>
                      );
                    })}
                  <option value="OTHER">Other Town / City (Type manually)</option>
                </select>
              </div>

              {destinationPark === 'OTHER' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="text-xs font-black uppercase text-slate-600 block">
                    Type Destination Town &amp; State *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Asaba - Summit Junction Park, Delta State"
                    value={customDestination}
                    onChange={(e) => {
                      setCustomDestination(e.target.value);
                      if (originPark && e.target.value.trim().toLowerCase() === originPark.trim().toLowerCase()) {
                        setError('Destination cannot be identical to the departure drop-off park.');
                      } else {
                        setError(null);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0A1F44] rounded-2xl py-3.5 px-4 text-sm font-bold text-slate-800 outline-none transition-all"
                    required
                  />
                </div>
              )}

              {/* Service Mode Selector */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-black uppercase text-slate-600 block">
                  Select Waybill Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'parcel', label: 'Standard Bus Parcel', desc: 'Loaded into passenger luxury bus / shuttle boot', icon: Package },
                    { id: 'haulage', label: 'Haulage / Truck Cargo', desc: 'Heavy boxes, bags, bulk merchandise', icon: Truck },
                    { id: 'express', label: 'Express Next-Vehicle', desc: 'First departing vehicle priority', icon: Sparkles }
                  ].map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <div
                        key={mode.id}
                        onClick={() => setServiceMode(mode.id as any)}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          serviceMode === mode.id
                            ? 'border-[#0A1F44] bg-blue-50/50 shadow-xs'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${serviceMode === mode.id ? 'text-[#0A1F44]' : 'text-slate-400'}`} />
                          <h4 className="font-black text-xs text-[#0A1F44]">{mode.label}</h4>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium leading-snug">{mode.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-black py-4 px-6 rounded-2xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Continue to Contacts</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* STEP 2: SENDER & RECEIVER CONTACTS */}
        {step === 2 && (
          <form onSubmit={handleNextStep2} className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-600" /> Step 2: Sender &amp; Receiver Contacts
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  The receiver will use their phone number and secret PIN to claim the package.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* Sender Section */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
              <span className="text-[11px] font-black uppercase text-blue-900 block">Sender (You)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Your Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Chukwuemeka Obi"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-bold outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Your 11-Digit Phone *</label>
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="08012345678"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-bold outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Receiver Section */}
            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 space-y-3">
              <span className="text-[11px] font-black uppercase text-orange-900 block">Receiver (Collects Parcel at Destination)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Receiver's Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Amaka Nwosu"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-bold outline-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 block">Receiver's 11-Digit Phone *</label>
                  <input
                    type="tel"
                    maxLength={11}
                    placeholder="08099887766"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-sm font-bold outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-grow bg-[#0A1F44] hover:bg-[#143265] text-white font-black py-4 px-6 rounded-2xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Continue to Package Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: PARCEL DETAILS */}
        {step === 3 && (
          <form onSubmit={handleNextStep3} className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" /> Step 3: Package &amp; Cargo Information
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Provide accurate details for tagging and manifest logging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-600 block">Item Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm font-bold text-slate-800 outline-none"
                  >
                    <option value="General Goods">General Goods / Merchandise</option>
                    <option value="Electronics">Electronics &amp; Gadgets</option>
                    <option value="Foodstuffs">Foodstuffs &amp; Provisions</option>
                    <option value="Clothing">Fabrics, Shoes &amp; Clothing</option>
                    <option value="Spare Parts">Automobile &amp; Machinery Spare Parts</option>
                    <option value="Documents">Official Documents &amp; Envelopes</option>
                    <option value="Fragile">Fragile / Glass / Cosmetics</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-600 block">Quantity (Bags / Cartons) *</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm font-bold text-slate-800 outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-600 block">
                  Package Description *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 1 Brown carton sealed with black tape containing Samsung phone batteries"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-[#0A1F44] rounded-2xl py-3 px-4 text-sm font-bold text-slate-800 outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-600 block">Estimated Weight (kg)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={weightKg}
                    onChange={(e) => setWeightKg(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm font-bold text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-600 block">Declared Value (₦ Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 50000"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3.5 text-sm font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-grow bg-[#0A1F44] hover:bg-[#143265] text-white font-black py-4 px-6 rounded-2xl text-sm transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Review &amp; Generate Pass</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: REVIEW & PAYMENT SELECTION */}
        {step === 4 && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Step 4: Review &amp; Payment
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Confirm your shipment details before generating your digital pass.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Route &amp; Park</span>
                <p className="font-extrabold text-[#0A1F44] text-sm">
                  From: {originPark}
                </p>
                <p className="font-extrabold text-[#0A1F44] text-sm">
                  To: {destinationPark === 'OTHER' ? customDestination : destinationPark}
                </p>
                <span className="inline-block bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded-md text-[11px]">
                  Mode: {serviceMode.toUpperCase()}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Contacts</span>
                <p className="text-slate-700"><strong>Sender:</strong> {senderName} ({senderPhone})</p>
                <p className="text-slate-700"><strong>Receiver:</strong> {receiverName} ({receiverPhone})</p>
                <p className="text-slate-700"><strong>Item:</strong> {itemDescription} ({quantity} item(s))</p>
              </div>
            </div>

            {/* Payment Method Option */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-black uppercase text-slate-600 block">
                Choose Payment Method
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setPaymentMethod('pay_at_counter')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'pay_at_counter'
                      ? 'border-[#0A1F44] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h4 className="font-black text-xs text-[#0A1F44]">Pay Cash / POS at Counter</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Pay park staff when dropping the parcel</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setPaymentMethod('online_card')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    paymentMethod === 'online_card'
                      ? 'border-[#0A1F44] bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <div>
                      <h4 className="font-black text-xs text-[#0A1F44]">Pre-Paid Online (Card / Transfer)</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Instant zero-delay drop off</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated Fare Box */}
            <div className="bg-orange-50/60 border border-orange-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-900 block">
                  Estimated Manifest &amp; Waybill Fee
                </span>
                <p className="text-xs text-slate-500 font-medium">Includes ₦100 official electronic manifest levy</p>
              </div>
              <div className="text-right">
                <span className="font-black text-xl text-[#0A1F44]">₦{estimatedFee.toLocaleString()}</span>
                <p className="text-[10px] text-slate-400 font-semibold">Standard estimate</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSubmitBooking}
                disabled={loading}
                className="flex-grow bg-[#F7941D] hover:bg-[#e07d0f] text-[#0A1F44] font-black py-4 px-6 rounded-2xl text-base transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0A1F44] border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating Pre-Booking Pass...</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-5 h-5" />
                    <span>Get Digital Waybill Pass</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: SUCCESS DIGITAL PASS */}
        {step === 5 && passData && (
          <div className="space-y-6 animate-fadeIn">
            <WaybillBarcodePass passData={passData} />

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setPassData(null);
                  setItemDescription('');
                  setReceiverName('');
                  setReceiverPhone('');
                }}
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0A1F44] bg-white border border-slate-200 px-4 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <span>+ Book Another Parcel</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-4xl mx-auto px-4 space-y-1">
          <p>© {new Date().getFullYear()} Waybilla Technologies. Nigeria's Hybrid Interstate Waybill Network.</p>
          <p className="text-[11px] text-slate-400">Book at home or at the counter — verified tracking everywhere.</p>
        </div>
      </footer>
    </div>
  );
};
