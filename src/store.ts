import { create } from 'zustand';
import { SessionUser } from './types';

interface AuthState {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
}

// Helper to load session on start
const getInitialUser = (): SessionUser | null => {
  try {
    const sessionStr = localStorage.getItem('trackpack_session');
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      if (session && session.user && session.expiresAt && session.expiresAt > Date.now()) {
        return session.user;
      } else {
        localStorage.removeItem('trackpack_session');
      }
    }
  } catch (e) {
    console.error('Failed to parse trackpack session', e);
  }
  return null;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getInitialUser(),
  login: (user) => {
    // 45 days session persistence
    const expiresAt = Date.now() + 45 * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem('trackpack_session', JSON.stringify({ user, expiresAt }));
    } catch (e) {
      console.error('Failed to save session to localStorage', e);
    }
    set({ user });
  },
  logout: () => {
    try {
      localStorage.removeItem('trackpack_session');
    } catch (e) {
      console.error('Failed to remove session from localStorage', e);
    }
    set({ user: null });
  },
}));

