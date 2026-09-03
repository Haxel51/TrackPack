import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginAdmin, verifyAdminOTP } from '../lib/api';
import { ShieldAlert, Mail, Lock, Eye, EyeOff, ChevronLeft, KeyRound, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { SessionExpiredBanner } from '../components/SessionExpiredBanner';

export const AdminLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const isExpiredParam = searchParams.get('expired') === 'true' || (location.state as { sessionExpired?: boolean })?.sessionExpired === true;
  const [showExpiredBanner, setShowExpiredBanner] = useState(isExpiredParam);

  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    // Set robots noindex nofollow on admin login page
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');

    if (token && role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  // Handle Step 1: Submit email & password
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setAttemptsLeft(null);

    if (!email.trim() || !password.trim()) {
      setError('Please fill out both email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginAdmin(email.trim(), password.trim());
      if (res.requires2FA) {
        setStep('2fa');
        setSuccessMsg(res.message || `A 6-digit verification code has been sent to ${res.sentTo || res.email || email}. Check your inbox!`);
      } else if (res.success) {
        login(res.token, res.user, 'admin');
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid email or password.');
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

  // Handle Step 2: Submit OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!otpCode.trim() || otpCode.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAdminOTP(email.trim(), otpCode.trim());
      if (res.success) {
        login(res.token, res.user, 'admin');
        navigate('/admin/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid verification code.');
      }
    } catch (err) {
      setError('An error occurred while verifying OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await loginAdmin(email.trim(), password.trim());
      if (res.requires2FA) {
        setSuccessMsg(`A new 6-digit code has been dispatched to ${email}.`);
      } else {
        setError(res.error || 'Failed to resend code. Please try again.');
      }
    } catch (err) {
      setError('Error requesting resend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <SessionExpiredBanner show={showExpiredBanner} onDismiss={() => setShowExpiredBanner(false)} />
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        
        {/* Back Link & Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>

          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
            {step === 'credentials' ? (
              <ShieldAlert className="text-[#0A1F44] w-6 h-6" />
            ) : (
              <KeyRound className="text-[#F2A93B] w-6 h-6" />
            )}
          </div>
          
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">
            {step === 'credentials' ? 'Admin Console Login' : '2-Factor Verification'}
          </h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {step === 'credentials'
              ? 'Authenticate with your authorized admin credentials to manage motor park operations.'
              : `Enter the 6-digit verification code sent to ${email}`}
          </p>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>{successMsg}</div>
          </div>
        )}

        {/* Error Alert */}
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

        {/* STEP 1: CREDENTIALS FORM */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Admin Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  placeholder="admin@transport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-12 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer bg-transparent border-0"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-[#F2A93B] rounded-full animate-spin"></div>
                  Verifying Password...
                </>
              ) : (
                <>
                  Continue with 2FA <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: 2FA OTP FORM */}
        {step === '2fa' && (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                6-Digit Verification Code
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  autoFocus
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-2xl font-black tracking-[0.4em] text-center text-[#0A1F44] placeholder-slate-300 outline-none transition-all disabled:opacity-50 font-mono"
                />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Code expires in 10 minutes. Check your spam/junk folder if needed.
              </p>
            </div>

            {/* Submit OTP Button */}
            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 px-4 rounded-2xl text-base tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-[#F2A93B] rounded-full animate-spin"></div>
                  Authenticating...
                </>
              ) : (
                'Verify & Access Admin Console'
              )}
            </button>

            {/* Helper Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={loading}
                className="text-xs font-bold text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 bg-transparent border-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Resend Code
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('credentials');
                  setError(null);
                  setSuccessMsg(null);
                }}
                disabled={loading}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
              >
                Back to Login
              </button>
            </div>
          </form>
        )}


      </div>
    </div>
  );
};
