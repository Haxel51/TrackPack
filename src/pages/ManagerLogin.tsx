import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkManagerPhone, setManagerPin, loginManager } from '../lib/api';
import { Shield, Eye, EyeOff, ChevronLeft, Phone, UserCheck, Building2, MapPin, CheckCircle2, KeyRound } from 'lucide-react';

export const ManagerLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  
  // Step: 'phone' (Stage 1 - check phone) | 'pin' (Stage 2 - enter/set PIN)
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  
  // Manager Verification Data from Backend
  const [managerInfo, setManagerInfo] = useState<{
    registered: boolean;
    has_pin: boolean;
    manager_name: string;
    company_name: string;
    park_location: string;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in as manager
  useEffect(() => {
    if (token && role === 'manager') {
      navigate('/manager/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  // Stage 1: Verify Phone Number against Transport Company Manager Records
  const handleCheckPhone = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanPhone = phoneNumber.trim();
    if (!cleanPhone) {
      setError('Please enter your 11-digit phone number.');
      return;
    }

    if (!/^\d{11}$/.test(cleanPhone)) {
      setError('Phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    setLoading(true);
    try {
      const res = await checkManagerPhone(cleanPhone);
      if (res.success && res.registered) {
        setManagerInfo({
          registered: true,
          has_pin: res.has_pin,
          manager_name: res.manager_name,
          company_name: res.company_name,
          park_location: res.park_location
        });
        setStep('pin');
      } else {
        setError(res.error || 'Phone number is not assigned to any transport company as a Manager.');
      }
    } catch (err) {
      setError('Unable to verify phone number. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: Create PIN or Sign In
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttemptsLeft(null);

    const cleanPhone = phoneNumber.trim();
    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!cleanPin) {
      setError('Please enter your 6-digit PIN.');
      return;
    }

    if (cleanPin.length !== 6 || !/^\d+$/.test(cleanPin)) {
      setError('PIN must be exactly 6 digits.');
      return;
    }

    setLoading(true);

    try {
      if (managerInfo && !managerInfo.has_pin) {
        // First Time or Reset PIN: Manager creates their own PIN
        if (!cleanConfirm) {
          setError('Please confirm your 6-digit PIN.');
          setLoading(false);
          return;
        }

        if (cleanPin !== cleanConfirm) {
          setError('PINs do not match. Please re-enter your 6-digit PIN.');
          setLoading(false);
          return;
        }

        const res = await setManagerPin(cleanPhone, cleanPin, cleanConfirm);
        if (res.success && res.token) {
          login(res.token, res.user, 'manager');
          navigate('/manager/dashboard', { replace: true });
        } else {
          setError(res.error || 'Failed to set PIN. Please try again.');
        }
      } else {
        // Standard Sign In with created PIN
        const res = await loginManager(cleanPhone, cleanPin);
        if (res.success && res.token) {
          login(res.token, res.user, 'manager');
          navigate('/manager/dashboard', { replace: true });
        } else {
          setError(res.error || 'Invalid PIN. Please check and try again.');
          if (res.attemptsLeft !== undefined) {
            setAttemptsLeft(res.attemptsLeft);
          }
        }
      }
    } catch (err) {
      setError('An error occurred during authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetStep = () => {
    setStep('phone');
    setManagerInfo(null);
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <UserCheck className="text-indigo-600 w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">Manager Portal</h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {step === 'phone' 
              ? 'Enter your phone number to match your transport company manager profile.' 
              : managerInfo?.has_pin 
                ? 'Enter your 6-digit PIN to access your manager dashboard.'
                : 'Set up your secret 6-digit PIN for first-time access.'}
          </p>
        </div>

        {/* STAGE 1: Check Phone Number */}
        {step === 'phone' && (
          <form onSubmit={handleCheckPhone} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="manager-phone" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                Manager Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="manager-phone"
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

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600 text-center space-y-1">
                <p>{error}</p>
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
                'Continue to Sign In'
              )}
            </button>
          </form>
        )}

        {/* STAGE 2: Manager Verified -> Enter PIN or Create PIN */}
        {step === 'pin' && managerInfo && (
          <form onSubmit={handlePinSubmit} className="space-y-5">
            {/* Verified Manager Badge */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-extrabold uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4" /> Company Manager Verified
                </div>
                <button
                  type="button"
                  onClick={handleResetStep}
                  className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer border-0 bg-transparent"
                >
                  Change Phone
                </button>
              </div>
              
              <div className="pt-1">
                <h3 className="text-base font-extrabold text-[#0A1F44]">{managerInfo.manager_name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1 font-bold text-slate-700">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    {managerInfo.company_name}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {managerInfo.park_location}
                  </span>
                </div>
              </div>
            </div>

            {/* If manager HAS NOT set a PIN yet */}
            {!managerInfo.has_pin ? (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-800 space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5 text-amber-900">
                    <KeyRound className="w-4 h-4 text-amber-600" /> First Time Setup: Create Your PIN
                  </p>
                  <p>Create a secret 6-digit PIN to secure your manager account for future sign-ins.</p>
                </div>

                {/* PIN Input */}
                <div className="space-y-1.5">
                  <label htmlFor="manager-new-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                    Create 6-Digit PIN
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Shield className="w-4 h-4" />
                    </span>
                    <input
                      id="manager-new-pin"
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

                {/* Confirm PIN Input */}
                <div className="space-y-1.5">
                  <label htmlFor="manager-confirm-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                    Confirm 6-Digit PIN
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Shield className="w-4 h-4" />
                    </span>
                    <input
                      id="manager-confirm-pin"
                      name="confirm_pin"
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      placeholder="••••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-lg font-bold text-[#0A1F44] placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* If manager ALREADY HAS a PIN */
              <div className="space-y-1.5">
                <label htmlFor="manager-existing-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  Enter 6-Digit PIN
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Shield className="w-4 h-4" />
                  </span>
                  <input
                    id="manager-existing-pin"
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
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-semibold text-red-600 text-center space-y-1">
                <p>{error}</p>
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <p className="text-[#0A1F44] font-bold">Warning: {attemptsLeft} attempt(s) remaining before lockout.</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#07152e] text-white font-bold py-4 rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : !managerInfo.has_pin ? (
                'Save PIN & Sign In'
              ) : (
                'Sign In as Manager'
              )}
            </button>
          </form>
        )}

        <div className="text-center pt-2 text-xs text-slate-400">
          <p>Managers create and secure their own private 6-digit PIN upon sign in.</p>
        </div>
      </div>
    </div>
  );
};
