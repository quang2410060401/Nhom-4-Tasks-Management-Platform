import { createContext, useContext } from 'react';
import type { UserMe } from '@/types';

export interface AuthContextValue {
  user: UserMe | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: false,
  isAuthenticated: false,
});

/**
 * Hook đọc auth context — dùng trong mọi component cần biết trạng thái đăng nhập.
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
