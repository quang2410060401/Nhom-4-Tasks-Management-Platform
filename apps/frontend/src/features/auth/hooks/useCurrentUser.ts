import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authKeys } from '@/lib/query/queryKeys';
import { tokenStorage } from '@/services/auth/tokenStorage';
import { getMeApi } from '../api';
import type { UserMe } from '../types';

/**
 * Hook lấy thông tin user hiện tại từ GET /auth/me.
 *
 * Chỉ fetch khi có token trong localStorage.
 * Dùng làm core cho AuthProvider — xác định trạng thái đăng nhập.
 */
export function useCurrentUser() {
  const token = useSyncExternalStore(
    tokenStorage.subscribe,
    tokenStorage.getToken,
    () => null,
  );
  const hasToken = !!token;

  const query = useQuery<UserMe>({
    queryKey: authKeys.me(),
    queryFn: getMeApi,
    enabled: hasToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const user = hasToken ? (query.data ?? null) : null;

  return {
    user,
    isLoading: query.isLoading && hasToken,
    isError: query.isError && hasToken,
    isAuthenticated: hasToken && !!user,
    refetch: query.refetch,
  };
}
