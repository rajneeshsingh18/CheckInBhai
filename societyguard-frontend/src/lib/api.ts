import axios from 'axios';

// Create a singleton axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach token if we have a way to manually attach it 
// (For this project, we rely on HTTP-Only cookies so this might be redundant, 
// but useful if we eventually migrate to localStorage or React Native)
api.interceptors.request.use(
  (config) => {
    // If you store the access token in memory or localStorage, attach it here
    // Example: 
    // const token = useAuthStore.getState().accessToken;
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized and auto-refresh token
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Attempt to refresh the token using the refresh-token endpoint
        // Because of withCredentials: true, the HttpOnly refresh cookie is automatically sent
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        // If successful, the backend sets a new HttpOnly access token cookie.
        // We can now safely retry the original request.
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token is expired or invalid. Force logout.
        // In a real app, you might trigger a Zustand action here to clear state
        console.error('Session expired. Please log in again.');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    // Pass all other errors down to the calling function
    return Promise.reject(error);
  }
);

export default api;
