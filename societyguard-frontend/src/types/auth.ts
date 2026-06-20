export type UserRole = 'SUPER_ADMIN' | 'SOCIETY_ADMIN' | 'GUARD' | 'RESIDENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mobile?: string;
  societyId?: string;
  flatId?: string;
  guard?: {
    id: string;
    userId: string;
    societyId: string;
    pinCode?: string;
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
