import { create } from 'zustand';
import Cookies from 'js-cookie';
import { User, AuthResponse } from '@/types/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (data: AuthResponse) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  login: (data: AuthResponse) => {
    Cookies.set('accessToken', data.accessToken, { expires: 1 });
    Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
    Cookies.set('user', JSON.stringify(data.user), { expires: 7 });
    set({ user: data.user, isLoading: false });
  },
  logout: () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    Cookies.remove('user');
    set({ user: null, isLoading: false });
    window.location.href = '/login';
  },
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  checkAuth: () => {
    try {
      const userStr = Cookies.get('user');
      if (userStr) {
        set({ user: JSON.parse(userStr), isLoading: false });
      } else {
        set({ user: null, isLoading: false });
      }
    } catch {
      set({ user: null, isLoading: false });
    }
  },
}));
