import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginCompany, registerCompany, requestCompanyPasswordReset, resetCompanyPassword } from '../lib/api';
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
  const [serviceMode, setServiceMode] = useState<'parcel' | 'fleet' | 'both'>('parcel');
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

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setError('Phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    setLoading(true);
    try {
      const res = await loginCompany(phone.trim(), password.trim());
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

    const cleanOwnerPhone = ownerPhone.replace(/\D/g, '');
    if (cleanOwnerPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
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
      const res = await registerCompany({
        company_name: companyName.trim(),
        owner_phone: ownerPhone.trim(),
        password: regPassword.trim(),
        park_name: parkName.trim(),
        park_location: parkLocation.trim(),
        service_mode: serviceMode
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

    const cleanOwnerPhone = ownerPhone.replace(/\D/g, '');
    if (cleanOwnerPhone.length !== 11) {
      setError('Owner phone number must be exactly 11 digits (e.g. 08012345678).');
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

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must contain both letters and numbers for security.');
      return;
    }

    const commonPwds = ["password", "12345678", "admin123", "company123", "trackpack", "waybilla", "00000000"];
    if (commonPwds.some(p => newPassword.toLowerCase().includes(p))) {
      setError('Password contains common weak patterns. Please choose a stronger password.');
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
          <div className="w-14 h-14 bg-[#08152B] rounded-2xl flex items-center justify-center border border-amber-400/30 shadow-md">
            <Building2 className="text-[#F2A93B] w-7 h-7" />
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
              ? 'Apply to join Waybilla Nigeria. Once approved by Super Admin, you can manage your parks and staff.'
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
                  maxLength={11}
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
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
              error.toLowerCase().includes("suspended") ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-3 shadow-sm animate-fade-in">
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                    <div>
                      <p className="font-extrabold text-amber-950 text-sm">Account Suspended</p>
                      <p className="mt-0.5 text-amber-800 text-xs font-semibold leading-relaxed">
                        {error}
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <a
                      href={`https://wa.me/2349031940521?text=${encodeURIComponent("Hello Waybilla Support, my transport company account on Waybilla has been suspended. I need assistance to reactivate it.")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.993L2 22l5.233-1.237a9.96 9.96 0 004.779 1.221h.005c5.505 0 9.988-4.478 9.989-9.985A9.982 9.982 0 0012.012 2zm.005 18.281a8.27 8.27 0 01-4.223-1.157l-.303-.18-3.138.742.833-3.057-.197-.314a8.27 8.27 0 01-1.272-4.331c0-4.562 3.712-8.274 8.276-8.274 2.21 0 4.288.861 5.852 2.427a8.22 8.22 0 012.422 5.857c0 4.563-3.712 8.276-8.275 8.276zm4.536-6.196c-.249-.125-1.472-.726-1.7-.809-.228-.083-.394-.125-.56.125-.166.249-.643.809-.788.975-.145.166-.29.187-.539.062a6.8 6.8 0 01-1.998-1.232 7.502 7.502 0 01-1.383-1.724c-.145-.249-.015-.384.109-.508.112-.112.249-.29.373-.435.125-.145.166-.249.249-.415.083-.166.042-.311-.021-.435-.062-.125-.56-1.349-.767-1.847-.202-.486-.407-.42-.56-.428l-.477-.008c-.166 0-.435.062-.663.311-.228.249-.871.851-.871 2.075 0 1.224.892 2.406 1.016 2.573.125.166 1.756 2.682 4.255 3.761.594.257 1.058.41 1.42.525.597.19 1.14.163 1.57.099.48-.072 1.472-.602 1.679-1.183.207-.581.207-1.079.145-1.183-.062-.104-.228-.187-.477-.312z"/>
                      </svg>
                      <span>Contact Support on WhatsApp</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-1">
                  <div>{error}</div>
                  {attemptsLeft !== null && attemptsLeft > 0 && (
                    <div className="text-red-500 text-[10px]">
                      Brute Force Warning: {attemptsLeft} attempts left before lockout.
                    </div>
                  )}
                </div>
              )
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
                  maxLength={11}
                  placeholder="e.g. 08012345678"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
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

            {/* Service & Operation Mode Selection */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                Select Service & Operation Mode
              </label>
              <div className="grid grid-cols-1 gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setServiceMode('parcel')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    serviceMode === 'parcel'
                      ? 'bg-[#0A1F44] text-white border-[#0A1F44] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-extrabold">📦 Motor Park & Parcel Waybills</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${serviceMode === 'parcel' ? 'text-slate-300' : 'text-slate-500'}`}>
                      For passenger transport & parcel tracking
                    </div>
                  </div>
                  {serviceMode === 'parcel' && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setServiceMode('fleet')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    serviceMode === 'fleet'
                      ? 'bg-amber-600 text-slate-950 border-amber-600 shadow-sm font-black'
                      : 'bg-amber-50 text-amber-950 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <div>
                    <div className="font-extrabold">🚛 Fleet Trip Tracking Only</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${serviceMode === 'fleet' ? 'text-slate-900' : 'text-amber-800'}`}>
                      For heavy trucks, round-trips & 3-checkpoint verification
                    </div>
                  </div>
                  {serviceMode === 'fleet' && <CheckCircle2 className="w-4 h-4 text-slate-950 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => setServiceMode('both')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    serviceMode === 'both'
                      ? 'bg-[#0A1F44] text-amber-300 border-[#0A1F44] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-extrabold">⚡ Both (Parcel & Fleet Tracking)</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${serviceMode === 'both' ? 'text-amber-200/80' : 'text-slate-500'}`}>
                      Full access to both passenger waybills & truck fleet trips
                    </div>
                  </div>
                  {serviceMode === 'both' && <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />}
                </button>
              </div>
            </div>

            {/* Initial Park / Depot Section */}
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#0A1F44]" />{' '}
                {serviceMode === 'fleet'
                  ? 'Fleet Headquarters & Main Depot Information'
                  : serviceMode === 'both'
                  ? 'Motor Park & Fleet Depot Information'
                  : 'Primary Motor Park Information'}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  {serviceMode === 'fleet' ? 'Fleet Yard / Depot Name' : 'Park Name'}
                </label>
                <input
                  type="text"
                  placeholder={
                    serviceMode === 'fleet'
                      ? 'e.g. Dangote Logistics Fleet Yard'
                      : 'e.g. Peace Park Jibowu'
                  }
                  value={parkName}
                  onChange={(e) => setParkName(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-xl py-2.5 px-3 text-sm font-medium outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  {serviceMode === 'fleet' ? 'Depot City / Location' : 'Park City / Location'}
                </label>
                <input
                  type="text"
                  placeholder={
                    serviceMode === 'fleet'
                      ? 'e.g. Port Harcourt Terminal'
                      : 'e.g. Lagos'
                  }
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
                href="https://wa.me/2349031940521?text=Hello%20Waybilla%20Support,%20I%20forgot%20my%20company%20owner%20access%20and%20need%20assistance%20with%20a%20reset%20code."
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
