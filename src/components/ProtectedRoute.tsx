import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'driver' | 'supplier_staff';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { token, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-navy border-t-amber rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-navy/70">Verifying security credentials...</p>
      </div>
    );
  }

  // Redirect to homepage if not authenticated or role mismatch
  if (!token || role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
