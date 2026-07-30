import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authSession } from '@/services/auth/authSession';
import { authKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/lib/constants/routes';
import { savePendingRedirectPath } from '@/lib/utils/navigation';

/**
 * Hook logout — xoá session + clear cache + navigate login.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const logout = (redirectTo?: string) => {
    authSession.clearSession();
    savePendingRedirectPath(null);

    // Cập nhật auth state ngay lập tức trước khi điều hướng.
    queryClient.setQueryData(authKeys.me(), null);
    queryClient.clear();

    navigate(redirectTo ?? ROUTES.LOGIN, { replace: true });
  };

  return { logout };
}
