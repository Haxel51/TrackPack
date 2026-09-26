import React, { useState, useEffect } from 'react';
import { TruckProfile, AssetCategory, TrackerModelType } from '../types';
import {
  X,
  Truck,
  User,
  Phone,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  Fuel,
  Bus,
  Package,
  Wrench,
  Car,
  HelpCircle,
  Check,
  Zap,
} from 'lucide-react';

interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    plate_number: string;
    asset_type?: AssetCategory;
    asset_name?: string;
    tracker_id?: string;
    tracker_model?: TrackerModelType | string;
    driver_name: string;
    driver_phone: string;
    payment_plan: 'per_trip' | 'monthly';
  }) => Promise<void>;
  editingTruck: TruckProfile | null;
  isSaving: boolean;
  error: string | null;
  setError: (err: string | null) => void;
}

const ASSET_CATEGORIES: Array<{
  id: AssetCategory;
  name: string;
  icon: any;
  desc: string;
  badge: string;
}> = [
  {
    id: 'heavy_truck',
    name: 'Heavy Truck / Flatbed',
    icon: Truck,
    desc: 'Cement, Steel, 40ft Containers & Heavy Haulage',
    badge: 'Logistics',
  },
  {
    id: 'fuel_tanker',
    name: 'Fuel & Gas Tanker',
    icon: Fuel,
    desc: 'PMS, AGO Diesel, DPK, LPG & Chemicals',
    badge: 'Oil & Gas',
  },
  {
    id: 'commercial_bus',
    name: 'Interstate Bus / Van',
    icon: Bus,
    desc: 'Passenger lines, Mass Transit & Park Fleets',
    badge: 'Transport',
  },
  {
    id: 'delivery_van',
    name: 'Delivery Van / Reefer',
    icon: Package,
    desc: 'FMCG, Cold-chain, Retail & Food Supplies',
    badge: 'Distribution',
  },
  {
    id: 'construction_equipment',
    name: 'Heavy Equipment',
    icon: Wrench,
    desc: 'Bulldozers, Excavators, Cranes & Site Plant',
    badge: 'Industrial',
  },
  {
    id: 'utility_vehicle',
    name: 'Utility / Fleet Car',
    icon: Car,
    desc: 'Company pickups, Escorts & Patrol vehicles',
    badge: 'Corporate',
  },
];

const TRACKER_MODELS: Array<{
  id: TrackerModelType;
  label: string;
  smsImeiCmd: string;
  smsApnCmd: string;
  battery: string;
}> = [
  {
    id: 'tk905',
    label: 'TK905 / TK915 (30-60 Day Magnetic GPS)',
    smsImeiCmd: 'imei123456',
    smsApnCmd: 'apn123456 web.gprs.mtnnigeria.net',
    battery: '5,000 - 10,000 mAh',
  },
  {
    id: 'sinotrack_st905',
    label: 'SinoTrack ST-905 / ST-915 (Heavy Duty Magnet)',
    smsImeiCmd: 'RCONF',
    smsApnCmd: '8030000 web.gprs.mtnnigeria.net',
    battery: '5,000 - 10,000 mAh',
  },
  {
    id: 'micodus',
    label: 'Micodus MP90G / MV730G (Anti-Tamper Sensor)',
    smsImeiCmd: 'PARAM#',
    smsApnCmd: 'APN,web.gprs.mtnnigeria.net#',
    battery: '6,000 mAh',
  },
  {
    id: 'gf07',
    label: 'GF-07 / GF-21 Mini Locator (Mini Magnet)',
    smsImeiCmd: 'imei',
    smsApnCmd: '777',
    battery: '400 - 800 mAh',
  },
  {
    id: 'teltonika',
    label: 'Teltonika Heavy Fleet Unit',
    smsImeiCmd: 'getimei',
    smsApnCmd: 'setparam 2001:web.gprs.mtnnigeria.net',
    battery: 'Vehicle Powered / Internal Battery',
  },
  {
    id: 'satellite_globalstar',
    label: 'Direct Satellite Asset Tracker (Globalstar / SPOT)',
    smsImeiCmd: 'Use ESN on device serial barcode',
    smsApnCmd: 'Satellite Data (No SIM)',
    battery: 'Solar / Multi-Year Battery',
  },
  {
    id: 'custom',
    label: 'Other / Universal GPS Tracker',
    smsImeiCmd: 'imei123456 or check123456',
    smsApnCmd: 'apn123456 <APN>',
    battery: 'Custom',
  },
];

export const TruckModal: React.FC<TruckModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingTruck,
  isSaving,
  error,
  setError,
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [assetType, setAssetType] = useState<AssetCategory>('heavy_truck');
  const [assetName, setAssetName] = useState('');
  const [trackerId, setTrackerId] = useState('');
  const [trackerModel, setTrackerModel] = useState<TrackerModelType>('tk905');
  const [showSmsHelper, setShowSmsHelper] = useState(false);
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [paymentPlan, setPaymentPlan] = useState<'per_trip' | 'monthly'>('per_trip');

  useEffect(() => {
    if (editingTruck) {
      setPlateNumber(editingTruck.plate_number || '');
      setAssetType((editingTruck.asset_type as AssetCategory) || 'heavy_truck');
      setAssetName(editingTruck.asset_name || '');
      setTrackerId(editingTruck.tracker_id || '');
      setTrackerModel((editingTruck.tracker_model as TrackerModelType) || 'tk905');
      setDriverName(editingTruck.driver_name || '');
      setDriverPhone(editingTruck.driver_phone || '');
      setPaymentPlan(editingTruck.payment_plan || 'per_trip');
    } else {
      setPlateNumber('');
      setAssetType('heavy_truck');
      setAssetName('');
      setTrackerId('');
      setTrackerModel('tk905');
      setDriverName('');
      setDriverPhone('');
      setPaymentPlan('per_trip');
    }
    setShowSmsHelper(false);
    setError(null);
  }, [editingTruck, isOpen, setError]);

  if (!isOpen) return null;

  const validatePhone = (phone: string): boolean => {
    const clean = phone.replace(/[\s-]/g, '');
    return /^(?:(?:\+?234)|0)[789][01]\d{8}$/.test(clean);
  };

  const currentTrackerInfo = TRACKER_MODELS.find((m) => m.id === trackerModel) || TRACKER_MODELS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPlate = plateNumber.trim().toUpperCase();
    const trimmedName = driverName.trim();
    const trimmedPhone = driverPhone.trim();
    const trimmedTrackerId = trackerId.trim();
    const trimmedAssetName = assetName.trim();

    if (!trimmedPlate) {
      setError('Vehicle Plate or Asset Registration Number is required');
      return;
    }

    if (!trimmedName) {
      setError('Driver or Fleet Operator name is required');
      return;
    }

    if (!trimmedPhone) {
      setError('Driver / Operator phone number is required');
      return;
    }

    if (!validatePhone(trimmedPhone)) {
      setError('Please enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)');
      return;
    }

    await onSave({
      plate_number: trimmedPlate,
      asset_type: assetType,
      asset_name: trimmedAssetName,
      tracker_id: trimmedTrackerId || undefined,
      tracker_model: trackerModel,
      driver_name: trimmedName,
      driver_phone: trimmedPhone,
      payment_plan: paymentPlan,
    });
  };

  return (
    <div
      id="truck-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col my-6 max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#0A1F44] text-white px-6 py-5 border-b border-[#15346A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-[#F7941D]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">
                  {editingTruck ? 'Edit Fleet Asset & Tracker' : 'Register Fleet Asset & Tracker'}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F7941D]/20 text-[#F7941D] border border-[#F7941D]/40">
                  Universal
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                Configure truck/tanker/bus profile, magnetic tracker IMEI, and billing plan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            id="close-truck-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs animate-fadeIn shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">{error}</div>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* SECTION 1: Asset Category Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#0A1F44] uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#F7941D]" />
                <span>1. Select Asset Category <span className="text-rose-500">*</span></span>
              </label>
              <span className="text-[11px] text-slate-500 font-semibold">Works for any industry</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ASSET_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                const isSelected = assetType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setAssetType(cat.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                      isSelected
                        ? 'bg-amber-50/60 border-[#F7941D] shadow-sm text-slate-900 ring-1 ring-[#F7941D]'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isSelected ? 'bg-[#0A1F44] text-[#F7941D]' : 'bg-slate-100 text-[#0A1F44]'
                      }`}>
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full border ${
                        isSelected ? 'bg-[#F7941D]/20 text-[#0A1F44] border-[#F7941D]/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {cat.badge}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-black tracking-tight leading-snug text-slate-900">{cat.name}</div>
                      <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5 leading-tight">{cat.desc}</p>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#0A1F44] text-[#F7941D] flex items-center justify-center shadow-xs">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Plate Number & Asset Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Plate Number / Asset ID <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                placeholder="e.g. KAN 482 XA / TANKER-08"
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-sm font-black text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] focus:ring-1 focus:ring-[#F7941D] focus:bg-white transition-colors uppercase tracking-wider font-mono"
                id="truck-plate-input"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span>Asset Nickname / Specs (Optional)</span>
              </label>
              <input
                type="text"
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                placeholder="e.g. Dangote 40ft Flatbed / 45kL PMS Tank"
                className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] focus:bg-white transition-colors"
                id="truck-asset-name-input"
              />
            </div>
          </div>

          {/* SECTION 3: Magnetic GPS Tracker Integration */}
          <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">
                  2. Magnetic Tracker Hardware
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSmsHelper(!showSmsHelper)}
                className="text-[11px] font-bold text-[#0A1F44] hover:text-[#F7941D] flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{showSmsHelper ? 'Hide SMS Codes' : 'Find IMEI / SMS Setup'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Tracker Model Selection */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Tracker Hardware Model</label>
                <select
                  value={trackerModel}
                  onChange={(e) => setTrackerModel(e.target.value as TrackerModelType)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#F7941D] cursor-pointer shadow-xs"
                >
                  {TRACKER_MODELS.map((tm) => (
                    <option key={tm.id} value={tm.id} className="bg-white text-slate-900">
                      {tm.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* IMEI / Device ID Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
                  <span>IMEI / Device Serial ID</span>
                  <span className="text-[10px] text-slate-500 font-normal">On back sticker</span>
                </label>
                <input
                  type="text"
                  value={trackerId}
                  onChange={(e) => setTrackerId(e.target.value.replace(/\s+/g, ''))}
                  placeholder="e.g. 864520048192837 or ESN"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] shadow-xs"
                  id="truck-tracker-imei-input"
                />
              </div>
            </div>

            {/* Helper banner for SMS lookup */}
            {showSmsHelper && (
              <div className="p-3.5 bg-amber-50 border border-[#F7941D]/30 rounded-xl space-y-2 text-xs animate-fadeIn">
                <div className="flex items-center gap-1.5 font-bold text-[#0A1F44]">
                  <Zap className="w-3.5 h-3.5 text-[#F7941D]" />
                  <span>SMS Quick Commands for {currentTrackerInfo.label}:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-xs">
                    <span className="text-slate-500 block text-[10px] font-semibold">Get IMEI / Device ID:</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      Send SMS: "{currentTrackerInfo.smsImeiCmd}" to SIM
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-amber-200 shadow-xs">
                    <span className="text-slate-500 block text-[10px] font-semibold">Configure MTN Data APN:</span>
                    <span className="font-mono text-emerald-700 font-bold">
                      "{currentTrackerInfo.smsApnCmd}"
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-600 leading-tight">
                  💡 You can attach any magnetic tracker by simply typing its IMEI sticker code or sending the SMS above to find it.
                </p>
              </div>
            )}
          </div>

          {/* SECTION 4: Driver / Fleet Operator Contacts */}
          <div className="space-y-3 pt-1">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#0A1F44]" />
              <span>3. Assigned Driver or Operator <span className="text-rose-500">*</span></span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Full Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Ibrahim Bello / Emeka Eze"
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] focus:bg-white transition-colors"
                  id="truck-driver-name-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600">Phone Number (Calling/WhatsApp)</label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl px-4 py-3 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#F7941D] focus:bg-white transition-colors"
                  id="truck-driver-phone-input"
                />
              </div>
            </div>
          </div>

          {/* SECTION 5: Payment Plan Selection */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#0A1F44]" />
              <span>4. Fleet Billing Plan</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Per Trip */}
              <label
                onClick={() => setPaymentPlan('per_trip')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  paymentPlan === 'per_trip'
                    ? 'bg-blue-50/80 border-[#0A1F44] text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id="plan-option-per-trip"
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentPlan === 'per_trip' ? 'border-[#0A1F44] bg-[#0A1F44]' : 'border-slate-400'
                }`}>
                  {paymentPlan === 'per_trip' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">Per-Trip Plan</span>
                    <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                      ₦1,000 / trip
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Pay ₦1,000 per trip dispatched.
                  </p>
                </div>
              </label>

              {/* Option 2: Monthly */}
              <label
                onClick={() => setPaymentPlan('monthly')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  paymentPlan === 'monthly'
                    ? 'bg-amber-50/80 border-[#F7941D] text-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
                id="plan-option-monthly"
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentPlan === 'monthly' ? 'border-[#F7941D] bg-[#F7941D]' : 'border-slate-400'
                }`}>
                  {paymentPlan === 'monthly' && <div className="w-1.5 h-1.5 rounded-full bg-[#0A1F44]" />}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs text-slate-900">Monthly Unlimited</span>
                    <span className="text-[10px] font-black bg-[#F7941D]/20 text-[#0A1F44] px-2 py-0.5 rounded-full border border-[#F7941D]/30">
                      ₦3,500 / mo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Unlimited trips all month long.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
              id="cancel-truck-modal-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-[#F7941D] hover:bg-[#e08215] disabled:opacity-50 text-[#0A1F44] font-black py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#F7941D]/20 cursor-pointer"
              id="save-truck-modal-btn"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0A1F44]" />
                  <span>Saving Asset...</span>
                </>
              ) : (
                <span>{editingTruck ? 'Update Fleet Asset' : 'Save Fleet Asset'}</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
