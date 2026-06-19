import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuth';
import { UserRole } from '@/types/auth';

export const useAuth = () => {
  const auth = useAuthStore();
  
  const checkAuth = auth.checkAuth;
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user: auth.user,
    isLoading: auth.isLoading,
    login: auth.login,
    logout: auth.logout,
  };
};

export const useRequireAuth = (redirectTo = '/login') => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push(redirectTo);
    }
  }, [user, isLoading, router, redirectTo]);

  return { user, isLoading };
};

export const useRequireRole = (allowedRoles: UserRole[], redirectTo = '/unauthorized') => {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      router.push(redirectTo);
    }
  }, [user, isLoading, router, allowedRoles, redirectTo]);

  return { user, isLoading };
};
