import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkStaffPhone, setStaffPin, loginStaff } from '../lib/api';
import { Shield, Lock, Eye, EyeOff, ChevronLeft, Phone, UserCheck, KeyRound, Building2, MapPin, CheckCircle2 } from 'lucide-react';
import { SessionExpiredBanner } from '../components/SessionExpiredBanner';

interface StaffProfileInfo {
  name: string;
  company_name: string;
  park_location: string;
  has_pin: boolean;
}

export const StaffLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isExpiredParam = searchParams.get('expired') === 'true' || (location.state as { sessionExpired?: boolean })?.sessionExpired === true;
  const [showExpiredBanner, setShowExpiredBanner] = useState(isExpiredParam);

  // Steps: 'phone' | 'pin'
  const [step, setStep] = useState<'phone' | 'pin'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffInfo, setStaffInfo] = useState<StaffProfileInfo | null>(null);

  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in as staff, redirect to dashboard
  useEffect(() => {
    if (token && role === 'staff') {
      navigate('/staff/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttemptsLeft(null);

    const clean = phoneNumber.trim().replace(/\s+/g, '');
    if (!clean) {
      setError('Please enter your registered 11-digit phone number.');
      return;
    }

    if (clean.length !== 11 || !/^\d+$/.test(clean)) {
      setError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    setLoading(true);
    try {
      const res = await checkStaffPhone(clean);
      if (res.success && res.registered) {
        setStaffInfo({
          name: res.staff_name || 'Staff Member',
          company_name: res.company_name || 'Transport Company',
          park_location: res.park_location || 'Assigned Station',
          has_pin: Boolean(res.has_pin)
        });
        setStep('pin');
        setPin('');
        setConfirmPin('');
      } else {
        setError(res.error || 'This phone number is not registered as active staff for any transport company. Please contact your company manager or CEO.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to verify phone number. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttemptsLeft(null);

    if (!pin.trim()) {
      setError('PIN is required.');
      return;
    }

    if (pin.length !== 4 && pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be a 4-digit or 6-digit number.');
      return;
    }

    const cleanPhone = phoneNumber.trim().replace(/\s+/g, '');

    // First time setup: requires confirm PIN
    if (!staffInfo?.has_pin) {
      if (pin !== confirmPin) {
        setError('PINs do not match. Please re-enter your secret PIN.');
        return;
      }

      setLoading(true);
      try {
        const res = await setStaffPin(cleanPhone, pin.trim(), confirmPin.trim());
        if (res.success && res.token) {
          login(res.token, res.user, 'staff');
          navigate('/staff/dashboard', { replace: true });
        } else {
          setError(res.error || 'Failed to save PIN.');
        }
      } catch (err: any) {
        setError(err?.message || 'Network error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Returning staff login
    setLoading(true);
    try {
      const res = await loginStaff(cleanPhone, pin.trim());
      if (res.success && res.token) {
        login(res.token, res.user, 'staff');
        navigate('/staff/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid PIN.');
        if (res.attemptsLeft !== undefined) {
          setAttemptsLeft(res.attemptsLeft);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPhone = () => {
    setStep('phone');
    setStaffInfo(null);
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <SessionExpiredBanner show={showExpiredBanner} onDismiss={() => setShowExpiredBanner(false)} />
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F7941D] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-14 h-14 bg-[#08152B] rounded-2xl flex items-center justify-center border border-orange-400/30 shadow-md">
            {step === 'phone' ? (
              <UserCheck className="text-[#F7941D] w-7 h-7" />
            ) : !staffInfo?.has_pin ? (
              <KeyRound className="text-[#F7941D] w-7 h-7" />
            ) : (
              <Lock className="text-[#F7941D] w-7 h-7" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">Staff Terminal Sign In</h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {step === 'phone'
              ? 'Enter your registered phone number to sign in to your station terminal.'
              : !staffInfo?.has_pin
                ? 'Create your secret 4-digit PIN for quick and secure daily logins.'
                : 'Enter your 4-digit PIN to access your station terminal.'}
          </p>
        </div>

        {/* STEP 1: Phone Number */}
        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="staff-phone" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                Staff Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="staff-phone"
                  name="phone"
                  type="tel"
                  maxLength={11}
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-base font-bold placeholder-slate-400 tracking-wider outline-none transition-all disabled:opacity-50"
                  aria-label="Enter your registered 11-digit phone number"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Enter the phone number registered by your park manager or company CEO.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-1">
                <div>{error}</div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-amber rounded-full animate-spin"></div>
                  Verifying Account...
                </>
              ) : (
                'Continue to Terminal'
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: PIN Setup or Entry */
          <form onSubmit={handlePinSubmit} className="space-y-5">
            {/* Staff Info Banner */}
            {staffInfo && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-600 text-xs font-extrabold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4" /> Staff Account Verified
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchPhone}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    Change Phone
                  </button>
                </div>
                <div className="border-t border-slate-200/60 pt-2 space-y-1">
                  <p className="text-sm font-extrabold text-[#0A1F44]">{staffInfo.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      <Building2 className="w-3 h-3 text-slate-400" /> {staffInfo.company_name}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      <MapPin className="w-3 h-3 text-slate-400" /> {staffInfo.park_location}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!staffInfo?.has_pin ? (
              /* First-Time PIN Setup */
              <div className="space-y-4">
                <div className="bg-orange-50 border border-orange-200 text-orange-950 p-3.5 rounded-2xl text-xs space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5 text-orange-800">
                    <KeyRound className="w-4 h-4 text-orange-600" /> First Time Sign-In: Choose Your PIN
                  </p>
                  <p className="text-orange-900 leading-relaxed font-medium">
                    Choose a secret 4-digit PIN for your terminal. You will use this PIN every time you sign in.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="create-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                    Choose 4-Digit PIN
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Shield className="w-4 h-4" />
                    </span>
                    <input
                      id="create-pin"
                      name="pin"
                      type={showPin ? 'text' : 'password'}
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-12 text-lg font-bold placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                    Confirm 4-Digit PIN
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Shield className="w-4 h-4" />
                    </span>
                    <input
                      id="confirm-pin"
                      name="confirm_pin"
                      type={showConfirmPin ? 'text' : 'password'}
                      maxLength={4}
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-12 text-lg font-bold placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPin(!showConfirmPin)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                    >
                      {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Returning Staff PIN Entry */
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="staff-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                    Enter Your 4-Digit PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStaffInfo(prev => prev ? ({ ...prev, has_pin: false }) : null);
                      setPin('');
                      setConfirmPin('');
                      setError(null);
                    }}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    Set / Reset PIN
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Shield className="w-4 h-4" />
                  </span>
                  <input
                    id="staff-pin"
                    name="pin"
                    type={showPin ? 'text' : 'password'}
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-12 text-lg font-bold placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                    aria-label="Enter your 4-digit staff PIN"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Haven't created a PIN yet or forgot it?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setStaffInfo(prev => prev ? ({ ...prev, has_pin: false }) : null);
                      setPin('');
                      setConfirmPin('');
                      setError(null);
                    }}
                    className="text-orange-600 font-bold hover:underline cursor-pointer"
                  >
                    Tap here to choose your PIN
                  </button>
                </p>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-2">
                <div>{error}</div>
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="text-red-500 text-[10px]">
                    Security Warning: {attemptsLeft} attempts left before temporary lockout.
                  </div>
                )}
                {staffInfo?.has_pin && (
                  <div className="pt-1 border-t border-red-200/60">
                    <button
                      type="button"
                      onClick={() => {
                        setStaffInfo(prev => prev ? ({ ...prev, has_pin: false }) : null);
                        setPin('');
                        setConfirmPin('');
                        setError(null);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-orange-700 hover:text-orange-800 font-extrabold underline cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Haven't set your own PIN yet? Click here to choose your 4-digit PIN now
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-amber rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : !staffInfo?.has_pin ? (
                'Save PIN & Sign In'
              ) : (
                'Sign In to Staff Account'
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          Protected by Waybilla Multi-Tenant Transport Security
        </div>
      </div>
    </div>
  );
};

