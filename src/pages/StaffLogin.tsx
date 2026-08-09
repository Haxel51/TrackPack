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
          <h1 className="text-2xl font-extrabold text-[#0A1F44]">Staff Sign In</h1>
          <p className="text-sm text-slate-500 max-w-xs">
            Enter your 4-digit staff PIN to log in. No phone number is needed.
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
            error.toLowerCase().includes("suspended") ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl text-xs font-bold leading-relaxed space-y-3 shadow-sm animate-fade-in">
                <div className="flex items-start gap-2.5">
                  <span className="text-amber-500 text-sm mt-0.5">⚠️</span>
                  <div>
                    <p className="font-extrabold text-amber-950 text-sm">Company Account Suspended</p>
                    <p className="mt-0.5 text-amber-800 text-xs font-semibold leading-relaxed">
                      {error}
                    </p>
                  </div>
                </div>
                <div className="pt-1">
                  <a
                    href={`https://wa.me/2349031940521?text=${encodeURIComponent("Hello Waybilla Support, I am transport staff and my company account on Waybilla has been suspended. I need assistance.")}`}
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
                <div className="w-5 h-5 border-2 border-white border-t-amber rounded-full animate-spin"></div>
                Verifying PIN...
              </>
            ) : (
              'Sign In to Staff Account'
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
