import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginStaff } from '../lib/api';
import { Shield, Lock, Eye, EyeOff, ChevronLeft } from 'lucide-react';

export const StaffLogin: React.FC = () => {
  const { token, role, login } = useAuth();
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (token && role === 'staff') {
      navigate('/staff/dashboard', { replace: true });
    }
  }, [token, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAttemptsLeft(null);

    if (!pin.trim()) {
      setError('PIN is required.');
      return;
    }

    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be a 4-digit number.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginStaff(pin.trim());
      if (res.success) {
        login(res.token, res.user, 'staff');
        navigate('/staff/dashboard', { replace: true });
      } else {
        setError(res.error || 'Invalid PIN.');
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <Link to="/" className="self-start text-[#0A1F44] hover:text-[#F2A93B] flex items-center gap-1 text-sm font-bold transition-colors mb-2">
            <ChevronLeft className="w-4 h-4" /> Back to Home
          </Link>
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
            <Lock className="text-[#0A1F44] w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">Staff Terminal Sign In</h1>
          <p className="text-sm text-slate-500 max-w-xs">
            Enter your unique 4-digit staff PIN to unlock your terminal console. No phone number is needed.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* PIN Field */}
          <div className="space-y-1.5">
            <label htmlFor="staff-pin" className="text-xs font-extrabold text-[#0A1F44] uppercase tracking-wider block">4-Digit PIN</label>
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
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-navy cursor-pointer"
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
                <div className="w-5 h-5 border-2 border-white border-t-amber rounded-full animate-spin"></div>
                Verifying PIN...
              </>
            ) : (
              'Enter Terminal Console'
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 border-t border-slate-100 pt-4">
          Test Staff Account PIN: <strong>1234</strong>
        </div>
      </div>
    </div>
  );
};
