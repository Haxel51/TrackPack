import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '../components/ui';
import { Search, User, Building, Send, Package, ArrowRight, Phone, Sparkles } from 'lucide-react';
import { FormEvent, useState, useEffect } from 'react';
import { useAuthStore } from '../store';

export function LandingPage() {
  const [trackingCode, setTrackingCode] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role === 'customer') {
      navigate('/customer', { replace: true });
    } else if (user?.role === 'sender') {
      navigate('/sender', { replace: true });
    } else if (user?.role === 'receiver') {
      navigate('/receiver', { replace: true });
    } else if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  const handleTrack = (e: FormEvent) => {
    e.preventDefault();
    if (trackingCode.trim()) {
      navigate(`/track/${trackingCode.trim()}`);
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto py-10 px-4">
      
      {/* Warm Joke Welcome Banner */}
      <div className="bg-gradient-to-r from-navy to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm text-xl font-bold">
          😂
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-bold text-base">Welcome to TrackPack!</h2>
            <span className="text-[10px] bg-emerald-400/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-400/30">
              Smile Guaranteed
            </span>
          </div>
          <p className="text-gray-200 text-xs sm:text-sm leading-relaxed">
            "Relax! Your waybill moves faster than village gossip on market day. 🏃💨 Put your feet up, grab your coffee, and let TrackPack do the heavy lifting while your package flies home!"
          </p>
        </div>
      </div>

      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-md p-1.5 border border-gray-200">
          <img src="/icon-192.png?v=3" alt="TrackPack Logo" referrerPolicy="no-referrer" className="w-full h-full rounded-xl object-cover" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-navy leading-tight">
          Never wonder where<br className="hidden sm:block" /> your waybill is again.
        </h1>
        <p className="text-gray-600 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
          TrackPack replaces paper waybills at transport parks with real-time status updates you can check anytime. Easily track your waybills and see your assigned driver instantly.
        </p>

        {/* Steps on How the App is Used */}
        <div className="pt-4 text-left">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              How to Use TrackPack
            </h2>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              3 Simple Steps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-lg bg-navy text-white font-extrabold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-xs text-navy">Book & Pay Waybill</h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Sender or Park Staff enters parcel details and receiver phone, then pays via Transfer or Card.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-lg bg-navy text-white font-extrabold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-xs text-navy">Get Tracking Code</h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                A unique code (e.g. <strong className="font-mono text-navy">TRK-4821</strong>) and digital receipt are generated instantly.
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-6 h-6 rounded-lg bg-navy text-white font-extrabold text-xs flex items-center justify-center">
                  3
                </span>
                <h3 className="font-bold text-xs text-navy">Track & Collect</h3>
              </div>
              <p className="text-[11px] text-gray-600 leading-relaxed">
                Track status live, see driver & bus details, and collect securely at destination park store.
              </p>
            </div>
          </div>

          {/* Crucial Sender Reminder */}
          <div className="mt-4 p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 shadow-2xs">
            <span className="text-xl shrink-0">💡</span>
            <div>
              <p className="font-bold text-xs text-amber-950 uppercase tracking-wider">Crucial Sender Reminder</p>
              <p className="text-xs text-amber-900 mt-1 leading-relaxed font-medium">
                Once payment is completed and the tracking code is generated, <strong>always remember to send/share the tracking code with the receiver</strong> so they can track the package live and collect it safely at the destination park!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold mb-2 text-navy">Public Waybill Tracking</h2>
        <p className="text-gray-600 text-xs sm:text-sm mb-4">
          Quickly check a waybill's real-time status without logging in using just the tracking code.
        </p>
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
          <Input 
            placeholder="e.g. TRK-4821" 
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            className="uppercase flex-1"
          />
          <Button type="submit" size="lg" className="w-full sm:w-auto font-bold">
            <Search className="w-4 h-4 mr-2" />
            Track
          </Button>
        </form>
      </div>

      {!user ? (
        <div className="grid grid-cols-1 gap-4">
          <Link to="/login/customer" className="group flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:border-navy hover:shadow-md transition-all duration-200 text-center sm:text-left">
            <div className="w-12 h-12 bg-blue-50 text-navy rounded-xl flex items-center justify-center group-hover:bg-navy group-hover:text-white transition-colors duration-200 shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="flex flex-col justify-center h-full">
              <h3 className="font-bold text-navy text-base">Customer Portal (Sender & Receiver)</h3>
              <p className="text-gray-600 text-xs mt-0.5">
                Log in with your phone and 6-digit PIN to manage all your shipments.
              </p>
            </div>
          </Link>

          <Link to="/partners" className="group flex flex-col sm:flex-row items-center sm:items-start gap-4 p-5 bg-gradient-to-r from-navy to-slate-900 text-white rounded-2xl hover:shadow-md transition-all duration-200 text-center sm:text-left border border-slate-800">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-amber shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Transport Park Partner Portal</h3>
                <span className="text-[10px] font-bold bg-amber/20 text-amber px-2.5 py-0.5 rounded-full border border-amber/30">Partner Support</span>
              </div>
              <p className="text-gray-300 text-xs mt-0.5">
                Run a motor park terminal? Register online or contact executive support at <strong className="text-white">0814 377 8304</strong>.
              </p>
            </div>
          </Link>
        </div>
      ) : (
        <div className="text-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <p className="text-gray-600 mb-4 text-sm">You are logged in as <span className="font-bold text-navy">{user.name || user.phone}</span>.</p>
          <Button onClick={() => navigate(`/${user.role}`)} size="lg" className="w-full sm:w-auto font-bold">
            Go to my Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      <div className="pt-4 pb-8 border-t border-gray-200 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 font-medium">
        <Link to="/login/staff" className="flex items-center hover:text-navy transition">
          <Send className="w-3.5 h-3.5 mr-1.5 text-navy" />
          Staff Cashier Portal
        </Link>
        <span>•</span>
        <Link to="/login/admin" className="flex items-center hover:text-navy transition">
          <Building className="w-3.5 h-3.5 mr-1.5 text-navy" />
          Company Owner Portal
        </Link>
        <span>•</span>
        <Link to="/partners" className="flex items-center text-emerald-700 font-bold hover:underline">
          <Phone className="w-3.5 h-3.5 mr-1 text-emerald-600" />
          Call Partner Support
        </Link>
      </div>

    </div>
  );
}
