import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'driver' | 'supplier_staff';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRole }) => {
  const { token, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-navy border-t-amber rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-semibold text-navy/70">Verifying security credentials...</p>
      </div>
    );
  }

  const isAuthorized = 
    role === allowedRole || 
    (allowedRole === 'manager' && (role === 'trip_monitor' || role === 'driver'));

  if (!token || !isAuthorized) {
    let targetLogin = '/';
    if (allowedRole === 'customer') targetLogin = '/customer/login';
    else if (allowedRole === 'company') targetLogin = '/company/login';
    else if (allowedRole === 'staff') targetLogin = '/staff/login';
    else if (allowedRole === 'admin') targetLogin = '/admin/login';
    else if (allowedRole === 'manager') targetLogin = '/login/manager';
    else if (allowedRole === 'driver') targetLogin = '/login/manager?role=driver';
    else if (allowedRole === 'supplier_staff') targetLogin = '/login/supplier-staff';

    const hadPriorSession = Boolean(
      typeof localStorage !== 'undefined' &&
      (localStorage.getItem('auth_token') || localStorage.getItem('token'))
    );

    const redirectUrl = hadPriorSession ? `${targetLogin}${targetLogin.includes('?') ? '&' : '?'}expired=true` : targetLogin;

    return <Navigate to={redirectUrl} state={{ sessionExpired: hadPriorSession, from: location }} replace />;
  }

  return <>{children}</>;
};

