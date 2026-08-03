import { ReactNode, useState, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { SplashScreen } from './components/SplashScreen';

// Lazy load secondary route pages to optimize initial bundle size & mobile performance
const PartnersPage = lazy(() => import('./pages/PartnersPage').then(m => ({ default: m.PartnersPage })));
const PlatformAdminDashboard = lazy(() => import('./pages/PlatformAdminDashboard').then(m => ({ default: m.PlatformAdminDashboard })));
const LoginStaff = lazy(() => import('./pages/LoginStaff').then(m => ({ default: m.LoginStaff })));
const LoginCustomer = lazy(() => import('./pages/LoginCustomer').then(m => ({ default: m.LoginCustomer })));
const LoginAdmin = lazy(() => import('./pages/LoginAdmin').then(m => ({ default: m.LoginAdmin })));
const StaffPortalView = lazy(() => import('./pages/StaffPortalView').then(m => ({ default: m.StaffPortalView })));
const CustomerView = lazy(() => import('./pages/CustomerView').then(m => ({ default: m.CustomerView })));
const AdminView = lazy(() => import('./pages/AdminView').then(m => ({ default: m.AdminView })));
const PublicTrackView = lazy(() => import('./pages/PublicTrackView').then(m => ({ default: m.PublicTrackView })));
const TermsPage = lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const FaqPage = lazy(() => import('./pages/FaqPage').then(m => ({ default: m.FaqPage })));

// Fallback Loader for Suspense
function PageFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="flex items-center gap-3 text-emerald-400 font-medium">
        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

// Protected Route Wrapper
function RequireAuth({ children, role }: { children: ReactNode, role?: string | string[] }) {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Navigate to="/" replace />;
  }
  
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role as string)) {
      return <Navigate to={`/${user.role}`} replace />;
    }
  }
  
  return <>{children}</>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  return (
    <BrowserRouter>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="admin/leads" element={<Navigate to="/platform-admin" replace />} />
            <Route path="platform-admin" element={<PlatformAdminDashboard />} />
            <Route path="login/staff" element={<LoginStaff />} />
            <Route path="login/customer" element={<LoginCustomer />} />
            <Route path="login/admin" element={<LoginAdmin />} />
            <Route path="track/:code" element={<PublicTrackView />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="faq" element={<FaqPage />} />
            
            <Route path="sender" element={
              <RequireAuth role={["sender", "receiver"]}>
                <StaffPortalView />
              </RequireAuth>
            } />
            
            <Route path="receiver" element={
              <RequireAuth role={["sender", "receiver"]}>
                <StaffPortalView />
              </RequireAuth>
            } />
            
            <Route path="customer" element={
              <RequireAuth role="customer">
                <CustomerView />
              </RequireAuth>
            } />
            
            <Route path="admin" element={
              <RequireAuth role="admin">
                <AdminView />
              </RequireAuth>
            } />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
