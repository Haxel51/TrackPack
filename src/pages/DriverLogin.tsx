import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Truck, Lock, Phone, ArrowLeft, AlertCircle, Eye, EyeOff, ShieldCheck, Smile } from 'lucide-react';

export const DriverLogin: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.trim().replace(/\D/g, '');
    const cleanPin = pin.trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      setError('Please enter your 11-digit phone number (e.g. 08012345678).');
      return;
    }
    if (!cleanPin || cleanPin.length !== 6) {
      setError('Your driver PIN must be 6 numbers (e.g. 123456).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber.trim(), pin: cleanPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Wrong phone number or PIN. Please check again.');

      login(data.token, data.user, data.role);
      navigate('/driver/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not log in. Please check your phone number and PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8 selection:bg-amber-500 selection:text-slate-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5" />
            <span>Driver Road App 🚚</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Driver Sign In
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Welcome Oga Driver! Enter your phone and PIN to see your trip and send updates.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-start space-x-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Driver Phone Number
              </label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="h-5 w-5" />
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="08012345678"
                  className="block w-full pl-11 pr-4 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono text-base tracking-wide transition-colors"
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Your normal 11-digit phone number</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                6-Digit Driver Secret PIN
              </label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="block w-full pl-11 pr-12 py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono text-lg tracking-[0.25em] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                The 6 numbers given to you by your Park Manager
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-400/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  <span>Open My Trip 🚚</span>
                </>
              )}
            </button>
          </form>

          {/* Help box */}
          <div className="pt-2 border-t border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-400">
              Forgot or don't know your PIN? Ask your Motor Park Manager or Company Oga to check or change it for you.
            </p>
            <div className="flex items-center justify-center space-x-1.5 text-xs text-amber-300 font-medium">
              <Smile className="w-3.5 h-3.5" />
              <span>Safe journey on the highway! No sleep for steering! 😴🚫</span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Are you a Park Manager? Click here to sign in</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
