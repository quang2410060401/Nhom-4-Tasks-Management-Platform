import { useEffect, type ReactNode } from 'react';
import { Spin } from 'antd';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { authSession } from '@/services/auth/authSession';
import { AuthContext } from './auth-context.ts';

// ──── Provider ────

/**
 * AuthProvider — xác định trạng thái đăng nhập cho toàn app.
 *
 * ANTI-STUCK UI DESIGN:
 * - Không có token → isLoading=false ngay lập tức, KHÔNG fetch, KHÔNG spinner
 * - Có token, đang fetch /auth/me → hiển thị full-page spinner (chỉ initial load)
 * - Fetch thành công → render children với user data
 * - Fetch lỗi (401 / network) → clear token, coi như chưa login, render children
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoading, isError, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (isError) {
      authSession.clearSession();
    }
  }, [isError]);

  // Chỉ hiện spinner khi CÓ token VÀ đang fetch lần đầu
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
