import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { normalizeApiError } from '@/services/http';
import { showApiError } from '@/services/ui/errorFeedback';
import { toastService } from '@/services/ui/toastService';
import { ROUTES } from '@/lib/constants/routes';
import { resetPasswordApi } from '../api';
import type { ResetPasswordPayload } from '../types';

/**
 * Hook đặt lại mật khẩu — POST /auth/reset-password.
 *
 * Sau khi thành công → toast "Đặt lại mật khẩu thành công" + navigate /login.
 * Lỗi: token hết hạn/không hợp lệ → toast error.
 */
export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: ResetPasswordPayload) => resetPasswordApi(data),
    onSuccess: () => {
      toastService.success('Đặt lại mật khẩu thành công, vui lòng đăng nhập lại');
      navigate(ROUTES.LOGIN, { replace: true });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
