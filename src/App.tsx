import { ReactNode, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { PartnersPage } from './pages/PartnersPage';
import { PlatformAdminDashboard } from './pages/PlatformAdminDashboard';
import { LoginStaff } from './pages/LoginStaff';
import { LoginCustomer } from './pages/LoginCustomer';
import { LoginAdmin } from './pages/LoginAdmin';
import { StaffPortalView } from './pages/StaffPortalView';
import { CustomerView } from './pages/CustomerView';
import { AdminView } from './pages/AdminView';
import { PublicTrackView } from './pages/PublicTrackView';
import { TermsPage } from './pages/TermsPage';
import { FaqPage } from './pages/FaqPage';
import { SplashScreen } from './components/SplashScreen';

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
    </BrowserRouter>
  );
}
