import { useQuery } from '@tanstack/react-query';
import { verifyEmailApi } from '../api';

/**
 * Hook xác nhận email — GET /auth/verify-email?token=xxx.
 *
 * Dùng query cache theo token để tránh double request trong React StrictMode
 * khi trang verify mount lại ở development.
 */
export function useVerifyEmail(token: string | null) {
  return useQuery({
    queryKey: ['auth', 'verify-email', token],
    queryFn: () => {
      if (!token) {
        throw new Error('Missing verification token');
      }
      return verifyEmailApi(token);
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}
