import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkSupplierStaffPhone, setSupplierStaffPin } from '../lib/api';
import { Building2, Lock, Phone, ArrowLeft, AlertCircle, Eye, EyeOff, Shield, UserCheck, MapPin, CheckCircle2, KeyRound } from 'lucide-react';

export const SupplierLogin: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [mode, setMode] = useState<'login' | 'set_pin'>('login');
  
  const [staffInfo, setStaffInfo] = useState<{
    staff_name: string;
    companies: Array<{
      staff_id: string;
      name: string;
      phone_number: string;
      company_id: string;
      company_name: string;
      ceo_name: string;
      supplier_id: string;
      supplier_name: string;
      has_pin?: boolean;
    }>;
  } | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const { token, role, login } = useAuth();

  useEffect(() => {
    if (token && role === 'supplier_staff') {
      navigate('/supplier/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  const handleCheckPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setError('Please enter your phone number.');
      return;
    }

    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number (e.g. 08012345678).');
      return;
    }

    setLoading(true);
    try {
      const res = await checkSupplierStaffPhone(cleanPhone);
      if (res.success && res.registered && res.companies?.length > 0) {
        setStaffInfo({
          staff_name: res.staff_name,
          companies: res.companies
        });
        const firstComp = res.companies[0];
        setSelectedCompanyId(firstComp.company_id);
        // If staff has never set a custom PIN, default to set_pin mode
        if (firstComp.has_pin === false) {
          setMode('set_pin');
        } else {
          setMode('login');
        }
        setStep('pin');
      } else {
        setError(res.error || 'Phone number is not assigned to any supplier/depot staff profile.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to verify phone number. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError('Please enter your PIN or password.');
      return;
    }

    setLoading(true);

    try {
      const targetCompany = staffInfo?.companies.find(c => c.company_id === selectedCompanyId) || staffInfo?.companies[0];
      const targetCompanyId = targetCompany?.company_id;

      if (mode === 'set_pin') {
        const cleanConfirm = confirmPin.trim();
        if (!cleanConfirm) {
          setError('Please confirm your PIN.');
          setLoading(false);
          return;
        }
        if (cleanPin !== cleanConfirm) {
          setError('PINs do not match. Please re-enter.');
          setLoading(false);
          return;
        }
        const res = await setSupplierStaffPin(phoneNumber, cleanPin, cleanConfirm, targetCompanyId || undefined);
        if (res.success && res.token) {
          login(res.token, res.user, res.role || 'supplier_staff');
          navigate('/supplier/dashboard', { replace: true });
        } else {
          setError(res.error || 'Failed to set PIN.');
        }
      } else {
        const endpoint = targetCompanyId ? '/api/auth/supplier-staff/select-company' : '/api/auth/supplier-staff/login';
        const bodyPayload = targetCompanyId 
          ? { phone_number: phoneNumber, pin: cleanPin, company_id: targetCompanyId }
          : { phone_number: phoneNumber, pin: cleanPin };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');

        login(data.token, data.user, data.role);
        navigate('/supplier/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your PIN.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetStep = () => {
    setStep('phone');
    setStaffInfo(null);
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const activeCompany = staffInfo?.companies.find(c => c.company_id === selectedCompanyId) || staffInfo?.companies[0];

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-14 h-14 bg-[#08152B] rounded-2xl flex items-center justify-center border border-amber-400/30 shadow-md">
            <Building2 className="text-[#F2A93B] w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">
            Supplier Staff Portal
          </h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {step === 'phone'
              ? 'Enter your phone number to match your transport partner company and depot.'
              : mode === 'set_pin'
                ? 'Set up your secure custom PIN or password to sign in.'
                : 'Enter your secure PIN or password to sign in to your supplier dashboard.'}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600 text-center space-y-1">
            <p>{error}</p>
          </div>
        )}

        {/* STAGE 1: Check Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleCheckPhone} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="supplier-phone" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                Supplier Staff Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="supplier-phone"
                  name="phone"
                  type="tel"
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-sm font-semibold text-[#0A1F44] placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#07152e] text-white font-bold py-4 rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Continue to Sign In'
              )}
            </button>
          </form>
        )}

        {/* STAGE 2: Verified Staff & Enter PIN / Password or Set PIN */}
        {step === 'pin' && staffInfo && activeCompany && (
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Verified Profile Card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-extrabold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Supplier Staff Verified
                </div>
                <button
                  type="button"
                  onClick={handleResetStep}
                  className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer border-0 bg-transparent"
                >
                  Change Phone
                </button>
              </div>
              
              <div className="pt-1 space-y-1">
                <h3 className="text-base font-extrabold text-[#0A1F44]">{staffInfo.staff_name}</h3>
                <div className="text-xs text-slate-600 font-medium space-y-0.5">
                  <p className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Transport Partner: {activeCompany.company_name}
                  </p>
                  <p className="text-slate-500 pl-5">CEO / Admin: <span className="font-semibold text-slate-700">{activeCompany.ceo_name}</span></p>
                  <p className="flex items-center gap-1.5 text-slate-700 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-500" />
                    Depot / Warehouse: <span className="font-bold">{activeCompany.supplier_name}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* If user belongs to multiple transport partners */}
            {staffInfo.companies.length > 1 && (
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  Select Transport Company
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto">
                  {staffInfo.companies.map((c) => (
                    <button
                      key={c.company_id}
                      type="button"
                      onClick={() => setSelectedCompanyId(c.company_id)}
                      className={`text-left p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                        selectedCompanyId === c.company_id
                          ? 'bg-[#0A1F44] text-white border-[#0A1F44]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{c.company_name}</span>
                      <span className="text-[10px] opacity-80">{c.supplier_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode Switcher: Sign In vs Create/Reset Custom PIN */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setPin(''); setConfirmPin(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'login' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In with PIN
              </button>
              <button
                type="button"
                onClick={() => { setMode('set_pin'); setPin(''); setConfirmPin(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  mode === 'set_pin' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Set / Reset PIN
              </button>
            </div>

            {/* PIN / Password Input */}
            <div className="space-y-1.5">
              <label htmlFor="supplier-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                {mode === 'set_pin' ? 'Create New 4-6 Digit PIN' : 'Enter PIN or Password'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Shield className="w-4 h-4" />
                </span>
                <input
                  id="supplier-pin"
                  name="pin"
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-lg font-bold text-[#0A1F44] placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm PIN if mode is set_pin */}
            {mode === 'set_pin' && (
              <div className="space-y-1.5">
                <label htmlFor="supplier-confirm-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  Confirm New PIN
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    id="supplier-confirm-pin"
                    name="confirm_pin"
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-lg font-bold text-[#0A1F44] placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#07152e] text-white font-bold py-4 rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                mode === 'set_pin' ? 'Save PIN & Sign In' : 'Sign In as Supplier Staff'
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2 text-xs text-slate-400">
          <p>Sign in with your phone number and secure PIN or set your own custom PIN.</p>
        </div>
      </div>
    </div>
  );
};
