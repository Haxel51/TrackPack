import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { useAuthStore } from '../store';
import { getStaffByPin } from '../lib/api';
import { KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export function LoginStaff() {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (pin.length !== 4) {
      setError('PIN must be 4 digits');
      return;
    }

    setLoading(true);
    try {
      const staff = await getStaffByPin(pin);
      if (staff) {
        login({
          role: staff.role,
          name: staff.name,
          park: staff.park,
          companyId: staff.companyId,
        });
        navigate(`/${staff.role}`);
      } else {
        setError('Invalid PIN or staff not found.');
      }
    } catch (err) {
      setError('Error logging in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <Link to="/" className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-navy mb-8">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </Link>
      
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <KeyRound className="w-6 h-6 text-navy" />
        </div>
        <h1 className="text-2xl font-bold text-navy mb-2">Staff Login</h1>
        <p className="text-gray-700 mb-6">Enter your 4-digit assigned PIN to access your park's dashboard.</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">4-Digit PIN</label>
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
                maxLength={4}
                placeholder="••••" 
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-widest font-mono pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-3 text-gray-400 hover:text-navy transition"
                aria-label={showPin ? "Hide PIN" : "Show PIN"}
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </div>
    </div>
  );
}
