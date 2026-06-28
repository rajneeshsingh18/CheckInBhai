import axios from 'axios';
import Cookies from 'js-cookie';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 & Token Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not a retry yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        // Attempt to refresh
        const res = await axios.post(`${API_URL}/auth/refresh-token`, { refreshToken });
        
        const newAccessToken = res.data.accessToken;
        
        // Save new token
        Cookies.set('accessToken', newAccessToken, { expires: 1 }); // 1 day
        
        // Update header and retry
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, logout user
        Cookies.remove('accessToken');
        Cookies.remove('refreshToken');
        Cookies.remove('user');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ==========================================
// TANSTACK QUERY HOOKS
// ==========================================

// ------------------------------------------
// 1. Auth Hooks
// ------------------------------------------

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { email: string; password?: string; pin?: string; societyId?: string; guardId?: string }) => {
      // Guard login route vs Standard login route
      const url = credentials.pin ? '/auth/guard/login' : '/auth/login';
      const res = await api.post(url, credentials);
      return res.data;
    },
    onSuccess: (data) => {
      // Store in Cookies and Zustand store (via auth store)
      Cookies.set('accessToken', data.accessToken, { expires: 1 });
      Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(data.user), { expires: 7 });
      queryClient.setQueryData(['current-user'], data.user);
      toast.success('Logged in successfully!');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      toast.error(msg);
    }
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (userData: any) => {
      const res = await api.post('/auth/register', userData);
      return res.data;
    },
    onSuccess: (data) => {
      Cookies.set('accessToken', data.accessToken, { expires: 1 });
      Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(data.user), { expires: 7 });
      toast.success('Registered successfully!');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed';
      toast.error(msg);
    }
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: async (idToken: string) => {
      const res = await api.post('/auth/google/mobile', { idToken });
      return res.data;
    },
    onSuccess: (data) => {
      Cookies.set('accessToken', data.accessToken, { expires: 1 });
      Cookies.set('refreshToken', data.refreshToken, { expires: 7 });
      Cookies.set('user', JSON.stringify(data.user), { expires: 7 });
      toast.success('Google Login successful!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Google auth failed');
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = Cookies.get('refreshToken');
      try {
        await api.post('/auth/logout', { refreshToken });
      } catch (err) {
        // Continue even if API fails
      }
    },
    onSuccess: () => {
      Cookies.remove('accessToken');
      Cookies.remove('refreshToken');
      Cookies.remove('user');
      queryClient.clear();
      toast.success('Logged out successfully');
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data.user;
    },
    staleTime: 5 * 60 * 1000, // 5 mins
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileData: { name?: string; mobile?: string; avatarUrl?: string }) => {
      const res = await api.put('/auth/profile', profileData);
      return res.data.user;
    },
    onSuccess: (updatedUser) => {
      Cookies.set('user', JSON.stringify(updatedUser), { expires: 7 });
      queryClient.setQueryData(['current-user'], updatedUser);
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      toast.success('Profile updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    }
  });
}

// ------------------------------------------
// 2. Visitor Hooks
// ------------------------------------------

export function useCreateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await api.post('/visitors/entry', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-entries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Visitor entry registered, waiting for resident approval.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to register visitor');
    }
  });
}

export function useApproveEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, otp }: { entryId: string; otp: string }) => {
      const res = await api.post('/visitors/approve', { entryId, otp });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Visitor approved successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Approval failed');
    }
  });
}

export function useRejectEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, otp, reason }: { entryId: string; otp: string; reason?: string }) => {
      const res = await api.post('/visitors/reject', { entryId, otp, reason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-entries'] });
      queryClient.invalidateQueries({ queryKey: ['pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.info('Visitor entry rejected.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Rejection failed');
    }
  });
}

export function useExitVisitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await api.post(`/visitors/exit/${entryId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-entries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Visitor exit recorded successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to record exit');
    }
  });
}

export function useTodayEntries(filters: { search?: string; status?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['visitor-entries', 'today', filters],
    queryFn: async () => {
      const res = await api.get('/visitors/today', { params: filters });
      return res.data.data;
    }
  });
}

export function useSearchVisitors(query: string) {
  return useQuery({
    queryKey: ['visitors', 'search', query],
    queryFn: async () => {
      if (!query) return [];
      const res = await api.get('/visitors/search', { params: { q: query } });
      return res.data.data;
    },
    enabled: !!query
  });
}

export function useResidentHistory(filters: { status?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ['visitor-entries', 'history', filters],
    queryFn: async () => {
      const res = await api.get('/visitors/history', { params: filters });
      return res.data.data;
    }
  });
}

export function usePendingCount() {
  return useQuery({
    queryKey: ['visitor-entries', 'pending-count'],
    queryFn: async () => {
      const res = await api.get('/visitors/pending-count');
      return res.data.data;
    }
  });
}

export function useAllSocietyFlats() {
  return useQuery({
    queryKey: ['flats', 'society'],
    queryFn: async () => {
      const res = await api.get('/visitors/flats');
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 3. Guest Pass Hooks
// ------------------------------------------

export function useCreatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (passData: { visitorName: string; visitorMobile: string; purpose?: string; validFrom?: string; validTill?: string }) => {
      const res = await api.post('/guest-passes', passData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-passes'] });
      toast.success('Guest pass created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create guest pass');
    }
  });
}

export function useValidatePass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (qrToken: string) => {
      const res = await api.post('/guest-passes/validate', { qrToken });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['visitor-entries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Pass Validated! Guest: ${data.visitor?.name}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Invalid or Expired pass');
    }
  });
}

export function useCancelPass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (passId: string) => {
      const res = await api.post(`/guest-passes/${passId}/cancel`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-passes'] });
      toast.info('Pass cancelled.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to cancel pass');
    }
  });
}

export function useRenewPass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ passId, validTill }: { passId: string; validTill: string }) => {
      const res = await api.post(`/guest-passes/${passId}/renew`, { validTill });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-passes'] });
      toast.success('Pass renewed successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to renew pass');
    }
  });
}

export function useMyPasses() {
  return useQuery({
    queryKey: ['guest-passes'],
    queryFn: async () => {
      const res = await api.get('/guest-passes/my-passes');
      return res.data.data;
    }
  });
}

export function useTodayQRScans() {
  return useQuery({
    queryKey: ['guest-passes', 'scans-today'],
    queryFn: async () => {
      const res = await api.get('/guest-passes/scans-today');
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 4. Delivery Hooks
// ------------------------------------------

export function useLogDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryData: { flatId: string; category: string; packageCount?: number; notes?: string }) => {
      const res = await api.post('/deliveries', deliveryData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Delivery package logged successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to log delivery');
    }
  });
}

export function usePickupDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const res = await api.post(`/deliveries/${deliveryId}/pickup`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Delivery picked up!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to collect package');
    }
  });
}

export function useMarkReturned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, notes }: { deliveryId: string; notes?: string }) => {
      const res = await api.post(`/deliveries/${deliveryId}/return`, { notes });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.info('Delivery marked as returned to courier');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to return delivery');
    }
  });
}

export function useTodayDeliveries() {
  return useQuery({
    queryKey: ['deliveries', 'today'],
    queryFn: async () => {
      const res = await api.get('/deliveries/today');
      return res.data.data;
    }
  });
}

export function useResidentDeliveries() {
  return useQuery({
    queryKey: ['deliveries', 'my'],
    queryFn: async () => {
      const res = await api.get('/deliveries/my-flat');
      return res.data.data;
    }
  });
}

export function useDeliveryStats() {
  return useQuery({
    queryKey: ['deliveries', 'stats'],
    queryFn: async () => {
      const res = await api.get('/deliveries/stats');
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 5. Staff Hooks
// ------------------------------------------

export function useRegisterStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (staffData: { name: string; type: string; mobile?: string; schedule?: any; notesForGuard?: string }) => {
      const res = await api.post('/staff', staffData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.success('Staff member registered successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to register staff');
    }
  });
}

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ staffId, flatId }: { staffId: string; flatId: string }) => {
      const res = await api.post('/attendance/check-in', { staffId, flatId });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Staff checked in');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Check-in failed');
    }
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attendanceId: string) => {
      const res = await api.post(`/attendance/check-out/${attendanceId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Staff checked out');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Check-out failed');
    }
  });
}

export function useStaffByFlat() {
  return useQuery({
    queryKey: ['staff', 'my-flat'],
    queryFn: async () => {
      const res = await api.get('/staff');
      return res.data.data;
    }
  });
}

export function useTodayAttendance() {
  return useQuery({
    queryKey: ['staff-attendance', 'today'],
    queryFn: async () => {
      const res = await api.get('/attendance/today');
      return res.data.data;
    }
  });
}

export function useAttendanceReport(filters: { dateFrom?: string; dateTo?: string; staffId?: string } = {}) {
  return useQuery({
    queryKey: ['staff-attendance', 'report', filters],
    queryFn: async () => {
      const res = await api.get('/attendance/report', { params: filters });
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 6. SOS Hooks
// ------------------------------------------

export function useRaiseSOS() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertData: { type: string; description?: string; location: string }) => {
      const res = await api.post('/sos', alertData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.error('Emergency SOS Raised! Help is on the way.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error?.message || err.response?.data?.error || 'Failed to raise SOS alert');
    }
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      const res = await api.post(`/sos/${alertId}/acknowledge`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('SOS Alert acknowledged.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to acknowledge alert');
    }
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ alertId, resolutionNotes }: { alertId: string; resolutionNotes: string }) => {
      const res = await api.post(`/sos/${alertId}/resolve`, { resolutionNotes });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sos-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('SOS Alert marked as RESOLVED');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to resolve alert');
    }
  });
}

export function useActiveAlerts() {
  return useQuery({
    queryKey: ['sos-alerts', 'active'],
    queryFn: async () => {
      const res = await api.get('/sos/active');
      return res.data.data;
    }
  });
}

export function useAlertHistory() {
  return useQuery({
    queryKey: ['sos-alerts', 'history'],
    queryFn: async () => {
      const res = await api.get('/sos/history');
      return res.data.data;
    }
  });
}

export function useAlertStats() {
  return useQuery({
    queryKey: ['sos-alerts', 'stats'],
    queryFn: async () => {
      const res = await api.get('/sos/stats');
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 7. Dashboard Hooks
// ------------------------------------------

export function useGuardDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'guard'],
    queryFn: async () => {
      const res = await api.get('/dashboard/guard');
      return res.data.data;
    }
  });
}

export function useResidentDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'resident'],
    queryFn: async () => {
      const res = await api.get('/dashboard/resident');
      return res.data.data;
    }
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: async () => {
      const res = await api.get('/dashboard/society-admin');
      return res.data.data;
    }
  });
}

// ------------------------------------------
// 8. Admin Specific Management Hooks
// ------------------------------------------

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin', 'overview-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/overview-stats');
      return res.data.data;
    }
  });
}

export function useVisitorAnalytics() {
  return useQuery({
    queryKey: ['admin', 'visitor-analytics'],
    queryFn: async () => {
      const res = await api.get('/admin/visitor-analytics');
      return res.data.data;
    }
  });
}

export function useGuardPerformance() {
  return useQuery({
    queryKey: ['admin', 'guard-performance'],
    queryFn: async () => {
      const res = await api.get('/admin/guard-performance');
      return res.data.data;
    }
  });
}

export function useAdminGuards() {
  return useQuery({
    queryKey: ['admin', 'guards'],
    queryFn: async () => {
      const res = await api.get('/admin/guards');
      return res.data.data;
    }
  });
}

export function useCreateGuard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (guardData: { name: string; email: string; mobile: string; shiftStart?: string; shiftEnd?: string; password?: string }) => {
      const res = await api.post('/admin/guards', guardData);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'guards'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'guard-performance'] });
      toast.success('Guard created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create guard');
    }
  });
}

export function useUpdateGuard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, guardData }: { id: string; guardData: any }) => {
      const res = await api.put(`/admin/guards/${id}`, guardData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'guards'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'guard-performance'] });
      toast.success('Guard details updated!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update guard');
    }
  });
}

export function useResetGuardPin() {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/admin/guards/${id}/reset-pin`);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`PIN reset successfully! New PIN: ${data.pin}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to reset PIN');
    }
  });
}

export function useGuardActivityLog(id: string) {
  return useQuery({
    queryKey: ['admin', 'guards', id, 'activity'],
    queryFn: async () => {
      const res = await api.get(`/admin/guards/${id}/activity`);
      return res.data.data;
    },
    enabled: !!id
  });
}

export function useTowers() {
  return useQuery({
    queryKey: ['admin', 'towers'],
    queryFn: async () => {
      const res = await api.get('/admin/towers');
      return res.data.data;
    }
  });
}

export function useCreateTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post('/admin/towers', { name });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Tower created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create tower');
    }
  });
}

export function useUpdateTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await api.put(`/admin/towers/${id}`, { name });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Tower updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update tower');
    }
  });
}

export function useDeleteTower() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/towers/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Tower deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete tower');
    }
  });
}

export function useCreateFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (flatData: { number: string; floor?: number; towerId: string }) => {
      const res = await api.post('/admin/flats', flatData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Flat created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create flat');
    }
  });
}

export function useUpdateFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, flatData }: { id: string; flatData: { number: string; floor?: number } }) => {
      const res = await api.put(`/admin/flats/${id}`, flatData);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Flat updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update flat');
    }
  });
}

export function useDeleteFlat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/admin/flats/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Flat deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete flat');
    }
  });
}

export function useAssignResident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: { email: string; name: string; mobile?: string; flatId: string }) => {
      const res = await api.post('/admin/residents/assign', assignment);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success('Resident assigned to flat successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to assign resident');
    }
  });
}

export function useBulkImportFlats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<{ towerName: string; flatNumber: string; floor?: number }>) => {
      const res = await api.post('/admin/flats/import-bulk', { rows });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'towers'] });
      toast.success(`Import completed! ${data.successCount} flats added.`);
      if (data.logs && data.logs.length > 0) {
        console.log('[Bulk Import Logs]', data.logs);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Bulk import failed');
    }
  });
}

export function useReportQuery(type: 'visitors' | 'deliveries' | 'staff-attendance' | 'sos-alerts' | 'guard-activity', filters: any) {
  return useQuery({
    queryKey: ['admin', 'reports', type, filters],
    queryFn: async () => {
      const res = await api.get(`/admin/reports/${type}`, { params: filters });
      return res.data.data;
    },
    enabled: !!type
  });
}
