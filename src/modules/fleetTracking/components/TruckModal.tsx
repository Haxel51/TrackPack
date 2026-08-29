import React, { useState, useEffect } from 'react';
import { TruckProfile } from '../types';
import { X, Truck, User, Phone, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface TruckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    plate_number: string;
    driver_name: string;
    driver_phone: string;
    payment_plan: 'per_trip' | 'monthly';
  }) => Promise<void>;
  editingTruck: TruckProfile | null;
  isSaving: boolean;
  error: string | null;
  setError: (err: string | null) => void;
}

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
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [paymentPlan, setPaymentPlan] = useState<'per_trip' | 'monthly'>('per_trip');

  useEffect(() => {
    if (editingTruck) {
      setPlateNumber(editingTruck.plate_number || '');
      setDriverName(editingTruck.driver_name || '');
      setDriverPhone(editingTruck.driver_phone || '');
      setPaymentPlan(editingTruck.payment_plan || 'per_trip');
    } else {
      setPlateNumber('');
      setDriverName('');
      setDriverPhone('');
      setPaymentPlan('per_trip');
    }
    setError(null);
  }, [editingTruck, isOpen, setError]);

  if (!isOpen) return null;

  const validatePhone = (phone: string): boolean => {
    const clean = phone.replace(/[\s-]/g, '');
    return /^(?:(?:\+?234)|0)[789][01]\d{8}$/.test(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedPlate = plateNumber.trim().toUpperCase();
    const trimmedName = driverName.trim();
    const trimmedPhone = driverPhone.trim();

    if (!trimmedPlate) {
      setError('Plate number is required');
      return;
    }

    if (!trimmedName) {
      setError('Driver name is required');
      return;
    }

    if (!trimmedPhone) {
      setError('Driver phone number is required');
      return;
    }

    if (!validatePhone(trimmedPhone)) {
      setError('Please enter a valid Nigerian phone number (e.g. 08012345678 or +2348012345678)');
      return;
    }

    await onSave({
      plate_number: trimmedPlate,
      driver_name: trimmedName,
      driver_phone: trimmedPhone,
      payment_plan: paymentPlan,
    });
  };

  return (
    <div
      id="truck-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col my-8">
        
        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {editingTruck ? 'Edit Truck Profile' : 'Add New Truck Profile'}
              </h3>
              <p className="text-xs text-slate-400">
                {editingTruck ? 'Update driver details and payment plan' : 'Register a new truck for fleet operations'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer"
            id="close-truck-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">{error}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Plate Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" />
              <span>Plate Number <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
              placeholder="e.g. KAN 482 XA"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors uppercase tracking-wider"
              id="truck-plate-input"
            />
          </div>

          {/* Driver Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Driver Name <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Ibrahim Bello"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              id="truck-driver-name-input"
            />
          </div>

          {/* Driver Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span>Driver Phone Number <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="tel"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="e.g. 08012345678 or +2348012345678"
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-semibold text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
              id="truck-driver-phone-input"
            />
          </div>

          {/* Payment Plan Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              <span>Payment Plan Option</span>
            </label>

            <div className="grid grid-cols-1 gap-3">
              
              {/* Option 1: Per Trip */}
              <label
                onClick={() => setPaymentPlan('per_trip')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  paymentPlan === 'per_trip'
                    ? 'bg-blue-500/10 border-blue-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
                id="plan-option-per-trip"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentPlan === 'per_trip' ? 'border-blue-500 bg-blue-500' : 'border-slate-600'
                }`}>
                  {paymentPlan === 'per_trip' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white">Per Trip</span>
                    <span className="text-xs font-black bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/30">
                      ₦1,000 / trip
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pay ₦1,000 per haulage dispatch initiated for this truck.
                  </p>
                </div>
              </label>

              {/* Option 2: Monthly */}
              <label
                onClick={() => setPaymentPlan('monthly')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                  paymentPlan === 'monthly'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
                id="plan-option-monthly"
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  paymentPlan === 'monthly' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'
                }`}>
                  {paymentPlan === 'monthly' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-white">Monthly Subscription</span>
                    <span className="text-xs font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                      ₦3,500 / month
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Flat monthly coverage per truck for unlimited trip creations.
                  </p>
                </div>
              </label>

            </div>

            {/* Note when Monthly is selected */}
            {paymentPlan === 'monthly' && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-300 text-xs flex items-center gap-2 animate-fadeIn mt-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Subscription will be activated when payment is made at trip creation</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer"
              id="cancel-truck-modal-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black py-3 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
              id="save-truck-modal-btn"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingTruck ? 'Update Truck Profile' : 'Save Truck Profile'}</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
