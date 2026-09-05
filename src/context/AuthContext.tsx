import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getMe, logout as apiLogout } from '../lib/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  role: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'trip_monitor' | 'driver' | null;
  loading: boolean;
  login: (token: string, user: User, role: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'trip_monitor' | 'driver') => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
  });
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_user') : null;
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState<'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'trip_monitor' | 'driver' | null>(() => {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_role') as any) || null : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    // If we have cached token & role, don't block render with loading spinner
    return !(typeof localStorage !== 'undefined' && localStorage.getItem('auth_token') && localStorage.getItem('auth_role'));
  });

  const login = (newToken: string, newUser: User, newRole: 'customer' | 'company' | 'staff' | 'manager' | 'admin' | 'trip_monitor' | 'driver') => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('token', newToken);
    localStorage.setItem('manager_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    localStorage.setItem('auth_role', newRole);
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
    setLoading(false);
  };

  const logout = async () => {
    const currentToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') || localStorage.getItem('token') : null);
    if (currentToken) {
      await apiLogout(currentToken).catch(() => {});
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('company_token');
    localStorage.removeItem('manager_token');
    localStorage.removeItem('staff_token');
    localStorage.removeItem('driver_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_role');
    setToken(null);
    setUser(null);
    setRole(null);
    setLoading(false);
  };

  const checkSession = async () => {
    const currentToken = typeof localStorage !== 'undefined'
      ? localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('manager_token')
      : null;
    if (!currentToken) {
      setToken(null);
      setUser(null);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const data = await getMe(currentToken);
      if (data && data.valid) {
        setToken(currentToken);
        setUser(data.user);
        const resolvedRole = data.role || (data.user as any)?.role || (data.user?.manager_type === 'Driver' ? 'driver' : 'manager');
        setRole(resolvedRole);
        localStorage.setItem('auth_token', currentToken);
        localStorage.setItem('token', currentToken);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        localStorage.setItem('auth_role', resolvedRole);
      } else if (data && data.valid === false) {
        // Token is explicitly expired from server
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('company_token');
        localStorage.removeItem('manager_token');
        localStorage.removeItem('staff_token');
        localStorage.removeItem('driver_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_role');
        setToken(null);
        setUser(null);
        setRole(null);
      }
    } catch (err) {
      console.warn('Session verification background check error:', err);
      // Do not kick out on temporary offline/network fluctuation
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, role, loading, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
