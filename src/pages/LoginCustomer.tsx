import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuthStore } from '../store';
import { Smartphone, ArrowLeft, Loader2, ShieldCheck, Eye, EyeOff, Lock, UserPlus, LogIn, Info, X, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeTo11Digits } from '../lib/helpers';

export function LoginCustomer() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handlePinLogin = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeTo11Digits(phone);
    if (normalizedPhone.length !== 11) {
      setError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    if (pin.replace(/\D/g, '').length !== 6) {
      setError('Security PIN must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    try {
      const response = await fetch('/api/customer/login-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: normalizedPhone, pin })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        login({ role: 'customer', phone: normalizedPhone });
        navigate('/customer');
      } else {
        if (data.code === 'NO_PIN_SET') {
          setError(data.message);
          setSuccessMsg('You can set up your 6-digit PIN below.');
        } else {
          setError(data.message || 'Incorrect Security PIN. Please try again.');
        }
      }
    } catch (err: any) {
      console.warn('PIN Login network error:', err);
      setError('Network connection error. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPin = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedPhone = normalizeTo11Digits(phone);
    if (normalizedPhone.length !== 11) {
      setError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    const cleanPin = pin.replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setError('Security PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setError('Security PINs do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch('/api/customer/register-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phone: normalizedPhone, pin, confirmPin })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setSuccessMsg('Security PIN registered successfully! Logging you in...');
        setTimeout(() => {
          login({ role: 'customer', phone: normalizedPhone });
          navigate('/customer');
        }, 1200);
      } else {
        setError(data.message || 'Failed to register PIN. Please try again.');
      }
    } catch (err: any) {
      console.error('Register PIN Error:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-navy mb-6 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Link>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 bg-blue-50 text-navy rounded-2xl flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-navy border border-blue-100 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-navy" />
            Secure Login
          </div>
        </div>

        <h1 className="text-2xl font-bold text-navy mb-1">
          {mode === 'login' ? 'Customer PIN Login' : 'Register 6-Digit PIN'}
        </h1>
        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          {mode === 'login' 
            ? 'Access your waybills securely using your phone number and 6-digit Secret PIN.' 
            : 'Set up a secure 6-digit PIN for your phone number to prevent unauthorized access.'}
        </p>

        {/* Clear Notice on Customer Access Rules */}
        <div className="bg-amber-50 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-900 mb-6 flex items-start gap-2.5 shadow-2xs">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-snug font-medium">
            <strong>Notice:</strong> The Customer Portal provides instant management of all waybills sent or received under your phone number. You can only log in or set up a PIN if your phone number is registered as sender or receiver on at least one waybill.
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-2 ${
              mode === 'login' ? 'bg-white text-navy font-bold shadow-xs' : 'text-gray-600 hover:text-navy'
            }`}
          >
            <LogIn className="w-4 h-4" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
              setSuccessMsg('');
            }}
            className={`py-2 rounded-lg transition flex items-center justify-center gap-2 ${
              mode === 'register' ? 'bg-white text-navy font-bold shadow-xs' : 'text-gray-600 hover:text-navy'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Set Up PIN
          </button>
        </div>
        
        {showForgotInfo && (
          <div className="bg-blue-50 text-blue-900 border border-blue-200 p-4 rounded-xl text-sm mb-5 relative leading-relaxed">
            <button
              type="button"
              onClick={() => setShowForgotInfo(false)}
              className="absolute top-2.5 right-2.5 text-blue-500 hover:text-blue-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="font-bold mb-1 flex items-center gap-1.5 text-navy text-sm">
              <Info className="w-4 h-4 text-navy" />
              PIN Reset Support
            </div>
            <p className="text-gray-700 text-xs leading-relaxed">
              For your shipment security, PIN resets require manual identity verification. Please visit any TrackPack office park or contact our customer support team directly at <span className="font-semibold text-navy">0801-TRACKPACK</span> to reset your secure code.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-800 border border-red-200 p-3.5 rounded-xl text-sm mb-5 font-medium leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-3.5 rounded-xl text-sm mb-5 font-medium leading-relaxed">
            ✅ {successMsg}
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handlePinLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <Input 
                type="tel"
                placeholder="e.g. 08012345678" 
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                disabled={loading}
              />
              {phone && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all duration-300 font-medium ${
                  normalizeTo11Digits(phone).length === 11 
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                }`}>
                  {normalizeTo11Digits(phone).length === 11 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-pulse" />
                      <span>Phone formatted correctly: <strong>{normalizeTo11Digits(phone)}</strong></span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 shrink-0 text-white animate-bounce" />
                      <span>Please enter an 11-digit phone number (currently: {normalizeTo11Digits(phone).length}/11 digits)</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">6-Digit Security PIN</label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-navy hover:underline flex items-center gap-1 font-medium"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Input 
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="••••••" 
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  className="tracking-widest font-mono text-lg pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pin && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all duration-300 font-medium ${
                  pin.length === 6 
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                }`}>
                  {pin.length === 6 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-pulse" />
                      <span>PIN is complete (6 digits of your choice)</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 shrink-0 text-white animate-bounce" />
                      <span>Enter your 6-digit security PIN ({pin.length}/6 digits entered)</span>
                    </>
                  )}
                </div>
              )}
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowForgotInfo(true)}
                  className="text-xs text-navy hover:underline font-medium transition"
                >
                  Forgot your code?
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full font-bold flex justify-center items-center gap-2 mt-2" size="lg" disabled={!phone || pin.length !== 6 || loading}>
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying PIN...
                </>
              ) : (
                'Log In to Waybills'
              )}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-xs text-navy hover:underline font-semibold"
              >
                New Customer or No PIN yet? Register 6-Digit PIN
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterPin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <Input 
                type="tel"
                placeholder="e.g. 08012345678" 
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setError('');
                }}
                disabled={loading}
              />
              {phone && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all duration-300 font-medium ${
                  normalizeTo11Digits(phone).length === 11 
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                }`}>
                  {normalizeTo11Digits(phone).length === 11 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-pulse" />
                      <span>Phone formatted correctly: <strong>{normalizeTo11Digits(phone)}</strong></span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 shrink-0 text-white animate-bounce" />
                      <span>Please enter your 11-digit phone number (currently: {normalizeTo11Digits(phone).length}/11 digits)</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Create 6-Digit Security PIN</label>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-navy hover:underline flex items-center gap-1 font-medium"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPin ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="relative">
                <Input 
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="e.g. 123456" 
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  className="tracking-widest font-mono text-lg pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pin && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all duration-300 font-medium ${
                  pin.length === 6 
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                }`}>
                  {pin.length === 6 ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-pulse" />
                      <span>Chosen PIN is complete (6 digits)</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 shrink-0 text-white animate-bounce" />
                      <span>Set any 6-digit security PIN of your choice ({pin.length}/6 digits entered)</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm 6-Digit Security PIN</label>
              <div className="relative">
                <Input 
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Re-enter 6 digits" 
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  className="tracking-widest font-mono text-lg pr-10"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPin && (
                <div className={`mt-2 p-2.5 rounded-lg border text-xs flex items-center gap-2 transition-all duration-300 font-medium ${
                  confirmPin.length === 6 && pin === confirmPin
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' 
                    : 'bg-amber-500 text-white border-amber-600 shadow-sm'
                }`}>
                  {confirmPin.length === 6 && pin === confirmPin ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-white animate-pulse" />
                      <span>PINs match perfectly! Ready to register.</span>
                    </>
                  ) : (
                    <>
                      <Info className="w-4 h-4 shrink-0 text-white animate-bounce" />
                      <span>{pin !== confirmPin ? "PINs do not match yet" : `Confirming PIN (${confirmPin.length}/6 digits entered)`}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full font-bold flex justify-center items-center gap-2 mt-2" size="lg" disabled={!phone || pin.length !== 6 || confirmPin.length !== 6 || loading}>
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving PIN...
                </>
              ) : (
                'Save PIN & Sign In'
              )}
            </Button>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccessMsg('');
                }}
                className="text-xs text-navy hover:underline font-semibold"
              >
                Already set your PIN? Back to Login
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center space-y-2">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            TrackPack Customer Portal • Secured with 256-Bit Encryption
          </p>
          <p className="text-[11px] text-gray-600">
            By signing in or registering, you agree to our <Link to="/terms" className="text-navy font-semibold underline hover:text-emerald-700">Terms & Conditions</Link> explaining why we protect your phone and waybill data.
          </p>
        </div>
      </div>
    </div>
  );
}
