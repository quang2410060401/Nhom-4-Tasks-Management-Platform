import { useMutation } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { normalizeApiError } from '@/services/http';
import { showApiError } from '@/services/ui/errorFeedback';
import { ROUTES } from '@/lib/constants/routes';
import { buildQueryString } from '@/lib/utils/queryString';
import { extractRedirectPath, savePendingRedirectPath } from '@/lib/utils/navigation';
import { registerApi } from '../api';
import type { RegisterPayload } from '../types';

/**
 * Hook đăng ký — POST /auth/register.
 *
 * Sau khi register thành công:
 * Navigate tới /verify-email (trang "Check your email").
 *
 * Lỗi 400 "Email đã tồn tại" → toast error.
 */
export function useRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  return useMutation({
    mutationFn: (data: RegisterPayload) => registerApi(data),
    onSuccess: () => {
      const redirectPath = extractRedirectPath(searchParams.toString());
      if (redirectPath) {
        savePendingRedirectPath(redirectPath);
      }

      navigate(
        `${ROUTES.VERIFY_EMAIL}${buildQueryString({ redirect: redirectPath ?? undefined })}`,
        { replace: true },
      );
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
