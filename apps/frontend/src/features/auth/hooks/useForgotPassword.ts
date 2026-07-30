import { useMutation } from '@tanstack/react-query';
import { normalizeApiError } from '@/services/http';
import { showApiError } from '@/services/ui/errorFeedback';
import { forgotPasswordApi } from '../api';
import type { ForgotPasswordPayload } from '../types';

/**
 * Hook quên mật khẩu — POST /auth/forgot-password.
 *
 * Backend luôn trả 200 (anti-enumeration) nên onSuccess luôn chạy.
 * Caller dùng isSuccess để chuyển UI sang "Check your email".
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordPayload) => forgotPasswordApi(data),
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
