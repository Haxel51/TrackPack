import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getMe, logout as apiLogout } from '../lib/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  role: 'customer' | 'company' | 'staff' | 'admin' | null;
  loading: boolean;
  login: (token: string, user: User, role: 'customer' | 'company' | 'staff' | 'admin') => void;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'customer' | 'company' | 'staff' | 'admin' | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const login = (newToken: string, newUser: User, newRole: 'customer' | 'company' | 'staff' | 'admin') => {
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setRole(newRole);
  };

  const logout = async () => {
    const currentToken = token || localStorage.getItem('auth_token');
    if (currentToken) {
      await apiLogout(currentToken);
    }
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  const checkSession = async () => {
    const currentToken = localStorage.getItem('auth_token');
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
        setRole(data.role);
      } else {
        // Token is invalid/expired
        localStorage.removeItem('auth_token');
        setToken(null);
        setUser(null);
        setRole(null);
      }
    } catch (err) {
      console.error('Session verification failed:', err);
      // Keep state as offline/logged-out in case of persistent error
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
