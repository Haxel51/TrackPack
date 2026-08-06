import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  Key,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  User,
  Building2,
  AlertCircle
} from 'lucide-react';
import { getReCaptchaToken } from '../lib/recaptcha';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();

  // Wizard Step State
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form Fields
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UX States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<'customer' | 'company' | null>(null);

  // STEP 1: Code Validation
  const handleValidateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !code.trim()) {
      setError('Please fill in both fields.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 11) {
      setError('Phone number must be exactly 11 digits (e.g. 08012345678).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch reCAPTCHA Token
      const token = await getReCaptchaToken('reset_validate_code');

      const res = await fetch('/api/auth/reset-password/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone.trim(),
          code: code.trim(),
          captcha_token: token
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid phone number or verification code.');
      } else {
        setAccountType(data.type);
        setStep(2);
      }
    } catch (err) {
      console.error('Validation error:', err);
      setError('A connection issue occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Submit New Password
  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Customer PIN checks (Exactly 6 digits)
    if (accountType === 'customer') {
      const isDigits = /^\d{6}$/.test(newPassword);
      if (!isDigits) {
        setError('PIN must be exactly 6 numeric digits.');
        return;
      }
    } else {
      // Company password checks
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
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch reCAPTCHA Token
      const token = await getReCaptchaToken('reset_submit');

      const res = await fetch('/api/auth/reset-password/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone.trim(),
          code: code.trim(),
          new_password: newPassword,
          captcha_token: token
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update credentials. Code may have expired.');
      } else {
        setStep(3);
      }
    } catch (err) {
      console.error('Submit password error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1F44] flex flex-col justify-center items-center p-4 relative overflow-hidden" id="reset-password-page">
      {/* Visual background details */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(242,169,59,0.12),rgba(255,255,255,0))]" />

      <div className="w-full max-w-md bg-white rounded-[32px] border border-slate-100 shadow-2xl p-8 relative z-10 space-y-6">
        
        {/* Logo and Headings */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-50 rounded-2xl text-[#F2A93B] mb-2">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-[#0A1F44] tracking-wide">
            Account Password Recovery
          </h2>
          <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
            {step === 1 && "Verify your registered mobile number and admin-assigned code."}
            {step === 2 && `Set a new security ${accountType === 'customer' ? 'PIN' : 'Password'} for your account.`}
            {step === 3 && "Your account has been fully restored."}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4.5 h-4.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleValidateCode}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  Registered Phone Number
                </label>
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
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  6-Digit Recovery Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="e.g. 123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold tracking-widest placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 rounded-2xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Verify Recovery Code</span>}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0A1F44] transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Homepage</span>
                </button>
              </div>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmitNewPassword}
              className="space-y-4"
            >
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-xs flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  accountType === 'customer' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {accountType === 'customer' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-extrabold text-[#0A1F44] capitalize">{accountType} Account Verified</p>
                  <p className="text-slate-400 font-medium">Please define your new security PIN/Password.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  {accountType === 'customer' ? 'New 6-Digit PIN' : 'New Password'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    maxLength={accountType === 'customer' ? 6 : undefined}
                    placeholder={accountType === 'customer' ? '••••••' : '••••••••'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-12 text-xs font-semibold placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">
                  Confirm {accountType === 'customer' ? 'PIN' : 'Password'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    maxLength={accountType === 'customer' ? 6 : undefined}
                    placeholder={accountType === 'customer' ? '••••••' : '••••••••'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="w-full bg-[#FAFAFA] border border-slate-200 focus:border-[#0A1F44] focus:ring-1 focus:ring-[#0A1F44] rounded-2xl py-3.5 pl-12 pr-4 text-xs font-semibold placeholder-slate-400 outline-none transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0A1F44] hover:bg-[#143265] text-white font-extrabold py-4 rounded-2xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update security credentials</span>}
              </button>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-black text-[#0A1F44]">
                  Reset Completed Successfully!
                </h3>
                <p className="text-xs text-slate-500 font-semibold max-w-xs mx-auto leading-relaxed">
                  Your new credentials have been safely initialized. You can now securely log in to your account.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => navigate('/login/customer')}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold py-3.5 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Shipper Login
                </button>
                <button
                  onClick={() => navigate('/login/company')}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold py-3.5 rounded-2xl text-xs transition-colors cursor-pointer"
                >
                  Operator Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
