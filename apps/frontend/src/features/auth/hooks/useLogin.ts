import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authKeys } from '@/lib/query/queryKeys';
import { authSession } from '@/services/auth/authSession';
import { normalizeApiError } from '@/services/http';
import { showAuthError } from '@/services/ui/errorFeedback';
import { toastService } from '@/services/ui/toastService';
import {
  consumePendingRedirectPath,
  extractRedirectPath,
  savePendingRedirectPath,
} from '@/lib/utils/navigation';
import { ROUTES } from '@/lib/constants/routes';
import { loginApi } from '../api';
import type { LoginPayload, UserMe } from '../types';

/**
 * Hook đăng nhập — POST /auth/login.
 *
 * Sau khi login thành công:
 * 1. Lưu token vào localStorage
 * 2. Invalidate query /auth/me để AuthProvider refetch
 * 3. Navigate tới redirect path (nếu có) hoặc /dashboard
 *
 * Xử lý lỗi:
 * - 403 "email chưa verify" → notification riêng
 * - 401 "sai password" → toast error
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useMutation({
    mutationFn: (data: LoginPayload) => loginApi(data),
    onSuccess: (result) => {
      authSession.saveSession(result.accessToken);

      // Seed cache từ login response để auth state cập nhật ngay lập tức.
      queryClient.setQueryData<UserMe>(authKeys.me(), {
        ...result.user,
        emailVerified: true,
      });
      queryClient.invalidateQueries({ queryKey: authKeys.me() });

      // Redirect path từ URL ?redirect=xxx (ví dụ invite flow)
      const redirectPath =
        extractRedirectPath(searchParams.toString()) ?? consumePendingRedirectPath();
      const targetPath =
        redirectPath && redirectPath !== ROUTES.HOME && redirectPath !== ROUTES.DASHBOARD
          ? redirectPath
          : ROUTES.DASHBOARD;

      savePendingRedirectPath(null);
      toastService.success('Đăng nhập thành công');
      navigate(targetPath, { replace: true });
    },
    onError: (error) => {
      showAuthError(normalizeApiError(error));
    },
  });
}
