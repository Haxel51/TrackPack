import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginCustomer, registerCustomer, requestCustomerPinReset, resetCustomerPin } from '../lib/api';
import { Package, Phone, Lock, Eye, EyeOff, ChevronLeft, UserPlus, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';

export const CustomerLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot_pin'>('login');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [isExisting, setIsExisting] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token && role === 'customer') {
      navigate('/customer/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsExisting(false);
    setAttemptsLeft(null);

    if (!phone.trim() || !pin.trim()) {
      setError('Please fill out all fields.');
      return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be a 6-digit number.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginCustomer(phone.trim(), pin.trim());
      if (res.success) {
        login(res.token, res.user, 'customer');
        navigate('/customer/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid phone number or PIN.');
        if (res.attemptsLeft !== undefined) {
          setAttemptsLeft(res.attemptsLeft);
        }
      }
    } catch (err) {
      setError('An error occurred. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsExisting(false);

    if (!phone.trim() || !pin.trim() || !confirmPin.trim()) {
      setError('Please fill out all fields.');
      return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError('PIN must be a 6-digit number.');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerCustomer(phone.trim(), pin.trim(), confirmPin.trim());
      if (res.success) {
        login(res.token, res.user, 'customer');
        navigate('/customer/dashboard', { replace: true });
      } else {
        setError(res.error || 'Failed to create account.');
        if (res.isExisting) {
          setIsExisting(true);
        }
      }
    } catch (err) {
      setError('An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setOtpNotice(null);

    if (!phone.trim()) {
      setError('Please enter your registered phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestCustomerPinReset(phone.trim());
      if (res.success) {
        setOtpNotice(res.otp ? `Verification Code: ${res.otp}` : null);
        setSuccessMsg(res.message);
        setResetStep(2);
      } else {
        setError(res.error || 'Account not found for this phone number.');
      }
    } catch (err) {
      setError('Failed to request PIN reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetCode.trim() || !pin.trim()) {
      setError('Please enter the verification code and your new 6-digit PIN.');
      return;
    }

    if (confirmPin && pin !== confirmPin) {
      setError('New PIN and Confirm PIN do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetCustomerPin({
        phone_number: phone.trim(),
        code: resetCode.trim(),
        new_pin: pin.trim(),
        confirm_pin: confirmPin.trim()
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setMode('login');
        setResetStep(1);
        setPin('');
        setConfirmPin('');
        setResetCode('');
        setOtpNotice(null);
      } else {
        setError(res.error || 'Failed to reset PIN.');
      }
    } catch (err) {
      setError('Failed to reset PIN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-12 h-12 bg-[#0A1F44]/5 rounded-2xl flex items-center justify-center">
            {mode === 'login' ? (
              <Package className="text-[#0A1F44] w-6 h-6" />
            ) : mode === 'signup' ? (
              <UserPlus className="text-[#0A1F44] w-6 h-6" />
            ) : (
              <KeyRound className="text-[#0A1F44] w-6 h-6" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">
            {mode === 'login' ? 'Customer Sign In' : mode === 'signup' ? 'Create Customer Account' : 'Reset Forgotten PIN'}
          </h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {mode === 'login'
              ? 'Enter your mobile number and secure 6-digit PIN to check and update your waybills.'
              : mode === 'signup'
              ? 'Register your phone number and create a strong 6-digit PIN to track your waybill deliveries.'
              : 'Recover access to your account by verifying your phone number.'}
          </p>
        </div>

        {/* Mode Toggle Tabs (Only shown for login/signup) */}
        {mode !== 'forgot_pin' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
                setIsExisting(false);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-[#0A1F44]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMsg(null);
                setIsExisting(false);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'signup' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-[#0A1F44]'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{successMsg}</div>
          </div>
        )}

        {/* Mode Forms */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Phone Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-phone-login" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="customer-phone-login"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  aria-label="Customer Phone Number"
                />
              </div>
            </div>

            {/* PIN Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="customer-pin-login" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">6-Digit PIN</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_pin');
                    setResetStep(1);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-bold text-[#F2A93B] hover:underline cursor-pointer"
                >
                  Forgot PIN?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="customer-pin-login"
                  name="pin"
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-12 text-base font-medium placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                  aria-label="Customer 6-Digit PIN"
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

            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-1">
                <div>{error}</div>
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="text-red-500 text-[10px]">
                    Brute Force Warning: {attemptsLeft} attempts left before lockout.
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
                  <div className="w-5 h-5 border-2 border-white border-t-[#F2A93B] rounded-full animate-spin"></div>
                  Signing In...
                </>
              ) : (
                'Sign In Securely'
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-xs font-bold text-[#0A1F44] hover:text-[#F2A93B] transition-colors bg-transparent border-0 cursor-pointer"
              >
                New here? Create an account
              </button>
            </div>
          </form>
        ) : mode === 'signup' ? (
          <form onSubmit={handleSignupSubmit} className="space-y-4">
            {/* Phone Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-phone-signup" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  id="customer-phone-signup"
                  name="phone"
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  aria-label="Customer Phone Number Signup"
                />
              </div>
            </div>

            {/* PIN Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-pin-signup" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Create Strong 6-Digit PIN</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="customer-pin-signup"
                  name="pin"
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-base font-medium placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                  aria-label="Create 6-Digit PIN"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                <span role="img" aria-label="padlock">🔒</span> Security requirement: Must be 6 digits. Avoid weak patterns like 123456 or 111111.
              </p>
            </div>

            {/* Confirm PIN Field */}
            <div className="space-y-1.5">
              <label htmlFor="customer-pin-confirm" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Confirm 6-Digit PIN</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="customer-pin-confirm"
                  name="confirmPin"
                  type={showPin ? 'text' : 'password'}
                  maxLength={6}
                  placeholder="••••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-base font-medium placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                  aria-label="Confirm 6-Digit PIN"
                />
              </div>
            </div>

            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-2">
                <div>{error}</div>
                {isExisting && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setIsExisting(false);
                    }}
                    className="text-xs font-extrabold text-[#0A1F44] underline hover:text-[#F2A93B] block cursor-pointer"
                  >
                    Click here to Log In
                  </button>
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
                  <div className="w-5 h-5 border-2 border-white border-t-[#F2A93B] rounded-full animate-spin"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  Create Account & Log In <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-[#0A1F44] transition-colors bg-transparent border-0 cursor-pointer"
              >
                Already have an account? Sign In
              </button>
            </div>
          </form>
        ) : (
          /* Forgot PIN Mode */
          <div className="space-y-4">
            {resetStep === 1 ? (
              <form onSubmit={handleForgotPinRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Registered Phone Number</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      placeholder="e.g. 08012345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-2xl text-xs font-bold">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Sending Code...' : 'Request Reset Code'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-[#0A1F44] transition-colors cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotPinReset} className="space-y-4">
                {otpNotice && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs font-bold space-y-1">
                    <div className="font-extrabold text-amber-800">🔑 Security Verification Code:</div>
                    <div className="text-lg font-mono tracking-widest text-[#0A1F44]">{otpNotice}</div>
                    <div className="text-[10px] text-amber-700 font-normal">Use this code to complete resetting your PIN.</div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Verification Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 px-4 text-base font-mono tracking-widest outline-none transition-all disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">New Strong 6-Digit PIN</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      placeholder="••••••"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-base font-medium placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
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
                  <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Confirm New 6-Digit PIN</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      placeholder="••••••"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      disabled={loading}
                      className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-base font-medium placeholder-slate-400 tracking-widest outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-2xl text-xs font-bold">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Resetting PIN...' : 'Save New PIN & Log In'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-xs font-bold text-slate-500 hover:text-[#0A1F44] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
