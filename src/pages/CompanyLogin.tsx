import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginCompany, registerCompany, requestCompanyPasswordReset, resetCompanyPassword } from '../lib/api';
import { getReCaptchaToken } from '../lib/recaptcha';
import { Building2, Phone, Lock, Eye, EyeOff, ChevronLeft, MapPin, CheckCircle2, ArrowRight, KeyRound } from 'lucide-react';

export const CompanyLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration state
  const [companyName, setCompanyName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [parkName, setParkName] = useState('');
  const [parkLocation, setParkLocation] = useState('');
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  // Reset state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token && role === 'company') {
      navigate('/company/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setAttemptsLeft(null);

    if (!phone.trim() || !password.trim()) {
      setError('Please fill out all fields.');
      return;
    }

    setLoading(true);
    try {
      const captchaToken = await getReCaptchaToken('company_login');
      const res = await loginCompany(phone.trim(), password.trim(), captchaToken);
      if (res.success) {
        login(res.token, res.user, 'company');
        navigate('/company/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid phone number or password.');
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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmittedMessage(null);

    if (
      !companyName.trim() ||
      !ownerPhone.trim() ||
      !regPassword.trim() ||
      !confirmPassword.trim() ||
      !parkName.trim() ||
      !parkLocation.trim()
    ) {
      setError('Please fill out all required fields.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(regPassword) || !/\d/.test(regPassword)) {
      setError('Password must contain both letters and numbers for security.');
      return;
    }

    setLoading(true);
    try {
      const captchaToken = await getReCaptchaToken('company_register');
      const res = await registerCompany({
        company_name: companyName.trim(),
        owner_phone: ownerPhone.trim(),
        password: regPassword.trim(),
        park_name: parkName.trim(),
        park_location: parkLocation.trim(),
        captcha_token: captchaToken
      });

      if (res.success) {
        setSubmittedMessage(
          res.message || "Application submitted! We'll review and approve your account soon. You'll be able to log in once approved."
        );
      } else {
        setError(res.error || 'Failed to submit application.');
      }
    } catch (err) {
      setError('An error occurred while submitting your application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setOtpNotice(null);

    if (!ownerPhone.trim()) {
      setError('Please enter your owner phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestCompanyPasswordReset(ownerPhone.trim());
      if (res.success) {
        setOtpNotice('initiated');
        setSuccessMsg(res.message);
        setResetStep(2);
      } else {
        setError(res.error || 'No company account found for this phone number.');
      }
    } catch (err) {
      setError('Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetCode.trim() || !newPassword.trim()) {
      setError('Please enter the verification code and your new password.');
      return;
    }

    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      setError('New Password and Confirm Password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetCompanyPassword({
        owner_phone: ownerPhone.trim(),
        code: resetCode.trim(),
        new_password: newPassword.trim(),
        confirm_password: confirmNewPassword.trim()
      });

      if (res.success) {
        setSuccessMsg(res.message);
        setMode('login');
        setResetStep(1);
        setNewPassword('');
        setConfirmNewPassword('');
        setResetCode('');
        setOtpNotice(null);
      } else {
        setError(res.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4 py-8">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            {mode === 'forgot_password' ? (
              <KeyRound className="text-[#0A1F44] w-6 h-6" />
            ) : (
              <Building2 className="text-[#0A1F44] w-6 h-6" />
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">
            {mode === 'login'
              ? 'Partner Sign In'
              : mode === 'register'
              ? 'Register Your Transport Company'
              : 'Reset Forgotten Password'}
          </h1>
          <p className="text-sm text-slate-500 max-w-xs">
            {mode === 'login'
              ? 'Log in to manage your motor parks, register transport staff, and audit transit operations.'
              : mode === 'register'
              ? 'Apply to join TrackPack Nigeria. Once approved by Super Admin, you can manage your parks and staff.'
              : 'Recover access to your company account by verifying your registered owner phone number.'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        {!submittedMessage && mode !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'login' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-[#0A1F44]'
              }`}
            >
              Partner Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`py-2.5 rounded-xl transition-all cursor-pointer ${
                mode === 'register' ? 'bg-white text-[#0A1F44] shadow-sm' : 'text-slate-500 hover:text-[#0A1F44]'
              }`}
            >
              Apply to Partner
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

        {/* Application Submitted Confirmation */}
        {submittedMessage ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Application Submitted!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {submittedMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmittedMessage(null);
                setMode('login');
              }}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all cursor-pointer"
            >
              Return to Partner Login
            </button>
          </div>
        ) : mode === 'login' ? (
          /* LOGIN FORM */
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {/* Phone Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Owner Phone Number</label>
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
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-4 pl-12 pr-4 text-base font-medium placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot_password');
                    setResetStep(1);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-xs font-bold text-[#F2A93B] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
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
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                'Sign In to Dashboard'
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="text-xs font-bold text-[#0A1F44] hover:text-[#F2A93B] transition-colors bg-transparent border-0 cursor-pointer"
              >
                New company? Apply to partner with us
              </button>
            </div>
          </form>
        ) : mode === 'register' ? (
          /* REGISTRATION FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Company Name */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Company Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Building2 className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="e.g. Peace Mass Transit"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-3 pl-10 pr-3 text-sm font-medium placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            {/* Owner Phone */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Owner Phone Number</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="tel"
                  placeholder="e.g. 08012345678"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-3 pl-10 pr-3 text-sm font-medium placeholder-slate-400 outline-none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Create Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-3 pl-10 pr-10 text-sm font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                >
                  {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-3 pl-10 pr-10 text-sm font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-[#0A1F44] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                🔒 Requirements: Minimum 8 characters with at least 1 letter & 1 number.
              </p>
            </div>

            {/* Initial Park Section */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#0A1F44]" /> Primary Park / Terminal Information
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Park Name</label>
                <input
                  type="text"
                  placeholder="e.g. Peace Park Jibowu"
                  value={parkName}
                  onChange={(e) => setParkName(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-2.5 px-3 text-sm font-medium outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">Park City / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Lagos"
                  value={parkLocation}
                  onChange={(e) => setParkLocation(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-2.5 px-3 text-sm font-medium outline-none"
                />
              </div>
            </div>

            {/* Alerts */}
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-xl text-xs font-bold leading-relaxed">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-3.5 px-4 rounded-xl text-sm tracking-wide transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-[#F2A93B] rounded-full animate-spin"></div>
                  Submitting Application...
                </>
              ) : (
                <>
                  Submit Application <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-[#0A1F44] transition-colors bg-transparent border-0 cursor-pointer"
              >
                Already registered? Sign In
              </button>
            </div>
          </form>
        ) : (
          /* FORGOT PASSWORD FORM */
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#25D366]/10 rounded-2xl flex items-center justify-center text-[#25D366]">
                  <Phone className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-black text-[#0A1F44]">
                  Assisted Password Reset
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Forgot your password? Message us on WhatsApp with your registered phone number and we'll help you reset it.
              </p>

              <a
                href="https://wa.me/2348030000000?text=Hello%20TrackPack%20Support,%20I%20forgot%20my%20company%20owner%20access%20and%20need%20assistance%20with%20a%20reset%20code."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm text-center"
              >
                <span>Message on WhatsApp</span>
              </a>
            </div>

            <div className="space-y-3 pt-2 text-center">
              <div className="text-xs text-slate-400 font-bold">
                Have a reset code?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/reset-password')}
                  className="text-[#F2A93B] hover:underline cursor-pointer font-black"
                >
                  Tap here
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="text-xs font-bold text-slate-500 hover:text-[#0A1F44] transition-colors cursor-pointer"
              >
                Back to Partner Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
