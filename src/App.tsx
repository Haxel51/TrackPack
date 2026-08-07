import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SplashScreen } from './components/SplashScreen';
import { IosInstallBanner } from './components/IosInstallBanner';
import { WhatsAppButton } from './components/WhatsAppButton';

// Pages
import { HomePage } from './pages/HomePage';
import { CustomerLogin } from './pages/CustomerLogin';
import { StaffLogin } from './pages/StaffLogin';
import { CompanyLogin } from './pages/CompanyLogin';
import { AdminLogin } from './pages/AdminLogin';
import { ResetPassword } from './pages/ResetPassword';

// Dashboards (Protected)
import { CustomerDashboard } from './pages/CustomerDashboard';
import { StaffDashboard } from './pages/StaffDashboard';
import { CompanyDashboard } from './pages/CompanyDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

export default function App() {
  const [splashFinished, setSplashFinished] = useState(false);

  return (
    <AuthProvider>
      {!splashFinished && (
        <SplashScreen onComplete={() => setSplashFinished(true)} duration={6000} />
      )}
      <IosInstallBanner />
      <WhatsAppButton />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login/customer" element={<CustomerLogin />} />
          <Route path="/login/staff" element={<StaffLogin />} />
          <Route path="/login/company" element={<CompanyLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes */}
          <Route
            path="/customer/dashboard"
            element={
              <ProtectedRoute allowedRole="customer">
                <CustomerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute allowedRole="staff">
                <StaffDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/company/dashboard"
            element={
              <ProtectedRoute allowedRole="company">
                <CompanyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback Catch-all -> Homepage */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

