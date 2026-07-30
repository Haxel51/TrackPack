import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { Button } from './ui';
import { Package, ShieldCheck, Phone } from 'lucide-react';
import { CustomerNotificationListener } from './CustomerNotificationListener';
import { FloatingWhatsApp } from './FloatingWhatsApp';
import { NotificationToastContainer } from './NotificationToast';

export function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // Multi-tap detection state for CEO / Super Admin secret trigger
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const handleSecretTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 1000) {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount >= 5) {
        setTapCount(0);
        setShowAdminModal(true);
      }
    } else {
      setTapCount(1);
    }
    setLastTapTime(now);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-bg-light flex flex-col font-sans relative">
      <NotificationToastContainer />
      <CustomerNotificationListener />
      <FloatingWhatsApp />
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={handleSecretTap}>
            <Link to={user ? `/${user.role}` : '/'} className="flex items-center gap-2.5">
              <img src="/logo_final_v4.jpg?v=4" alt="TrackPack Logo" referrerPolicy="no-referrer" className="w-8 h-8 rounded-lg object-cover shadow-sm border border-emerald-500/30" />
              <span className="font-bold text-xl tracking-tight text-navy">TrackPack</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {!user && (
              <Link to="/partners" className="text-xs font-bold text-navy hover:text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition">
                <Phone className="w-3.5 h-3.5 text-emerald-600" /> Partner Support
              </Link>
            )}

            {user && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-right hidden sm:block">
                  <p className="font-medium text-navy">{user.name || user.phone}</p>
                  <p className="text-gray-700 text-sm capitalize">{user.role} {user.park ? `· ${user.park}` : ''}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>Log out</Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-auto py-6 relative z-50">
        <div className="max-w-5xl mx-auto px-4 text-center space-y-2 pointer-events-auto">
          {!user && (
            <Link to="/partners" className="text-sm font-medium text-gray-700 hover:text-navy transition-colors inline-block pb-1">
              Run a transport park? Partner with us
            </Link>
          )}
          <div className="text-xs text-gray-500 pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="cursor-pointer select-none" onClick={handleSecretTap}>© {new Date().getFullYear()} TrackPack Systems</span>
            <span className="hidden sm:inline">•</span>
            <Link to="/faq" className="text-navy font-bold underline hover:text-emerald-700 cursor-pointer active:scale-95 transition-transform inline-block p-1">Waybill FAQs</Link>
            <span>•</span>
            <Link to="/terms" className="text-navy font-bold underline hover:text-emerald-700 cursor-pointer active:scale-95 transition-transform inline-block p-1">Terms & Conditions</Link>
          </div>
        </div>
      </footer>

      {/* Discreet CEO / Super Admin Portal Trigger Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-gray-200 text-center">
            <div className="w-12 h-12 bg-amber/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6 text-amber" />
            </div>
            <h3 className="text-lg font-bold text-navy mb-2">CEO / Super Admin Portal</h3>
            <p className="text-sm text-gray-600 mb-6">
              You triggered the secret admin gesture. Access the platform configuration and company approval dashboard.
            </p>
            <div className="flex gap-3">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setShowAdminModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-navy text-white hover:bg-navy/90" 
                onClick={() => {
                  setShowAdminModal(false);
                  navigate('/platform-admin');
                }}
              >
                Enter Portal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
