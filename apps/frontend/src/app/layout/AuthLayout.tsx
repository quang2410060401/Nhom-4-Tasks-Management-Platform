import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers';
import { ROUTES } from '@/lib/constants/routes';
import {
  extractRedirectPath,
  loadPendingRedirectPath,
  savePendingRedirectPath,
} from '@/lib/utils/navigation';

/**
 * Layout cho các trang auth (login, register, verify-email, ...).
 *
 * PublicOnlyRoute guard:
 * - Đã đăng nhập → redirect /dashboard (ngăn user login lại)
 * - Chưa đăng nhập → render trang auth
 */
export function AuthLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // AuthProvider đang fetch /auth/me → chờ
  if (isLoading) return null;

  // Đã login → redirect khỏi trang auth
  if (isAuthenticated) {
    const redirectPath =
      extractRedirectPath(location.search) ?? loadPendingRedirectPath();

    if (redirectPath && redirectPath !== ROUTES.LOGIN && redirectPath !== ROUTES.REGISTER) {
      savePendingRedirectPath(null);
      return <Navigate to={redirectPath} replace />;
    }

    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}
