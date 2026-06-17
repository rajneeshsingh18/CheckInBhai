import { create } from 'zustand';
import api from '@/lib/api';

export type UserRole = 'SUPER_ADMIN' | 'SOCIETY_ADMIN' | 'GUARD' | 'RESIDENT';

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  societyId: string | null;
  avatarUrl: string | null;
  authProvider: 'local' | 'google';
  emailVerified: boolean;
  // Included relations based on role
  resident?: { flatId: string; flat: { number: string; tower: { name: string } } };
  guard?: { isOnDuty: boolean; shiftStart: string | null };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  
  setLoading: (isLoading) => set({ isLoading }),

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await api.get('/auth/me');
      set({ user: response.data.user, isAuthenticated: true });
    } catch (error) {
      console.log('No active session found.');
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ user: null, isAuthenticated: false });
      // Redirect to login handled by components or interceptor usually, 
      // but force a hard reload is safest to clear React Query caches too
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }
}));
