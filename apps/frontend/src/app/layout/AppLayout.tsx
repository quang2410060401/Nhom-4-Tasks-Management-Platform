import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useAppUiStore, selectGlobalLoading, selectMobileSidebarOpen } from '@/store';
import { useAuth } from '@/app/providers';
import { buildLoginRedirectUrl } from '@/lib/utils/navigation';
import { getCurrentPathWithSearch } from '@/lib/utils/navigation';
import { AppLoading } from '@/components';
import { AppShellBrand } from './AppShellBrand';
import { AppSidebar } from './AppSidebar';
import { AppUserMenu } from './AppUserMenu';

/**
 * Layout chính cho các trang đã đăng nhập.
 *
 * ProtectedRoute guard:
 * - Chưa đăng nhập → redirect /login?redirect=currentPath
 * - Đã đăng nhập → render sidebar + header + content
 */
export function AppLayout() {
  const { isLoading, isAuthenticated } = useAuth();
  const isMobileSidebarOpen = useAppUiStore(selectMobileSidebarOpen);
  const openMobileSidebar = useAppUiStore((s) => s.openMobileSidebar);
  const closeMobileSidebar = useAppUiStore((s) => s.closeMobileSidebar);
  const globalLoading = useAppUiStore(selectGlobalLoading);
  const location = useLocation();

  useEffect(() => {
    if (isMobileSidebarOpen) {
      closeMobileSidebar();
    }
  }, [closeMobileSidebar, isMobileSidebarOpen, location.pathname, location.search]);

  // AuthProvider đang fetch /auth/me → chờ
  if (isLoading) return <AppLoading fullscreen tip="Đang kiểm tra phiên đăng nhập..." />;

  // Chưa login → redirect tới login, preserve current path
  if (!isAuthenticated) {
    const returnTo = getCurrentPathWithSearch(location.pathname, location.search);
    return <Navigate to={buildLoginRedirectUrl(returnTo)} replace />;
  }

  return (
    <div className="min-h-screen bg-background-light text-slate-900">
      {globalLoading && <AppLoading fullscreen tip="Đang xử lý..." />}

      <div className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:block lg:w-72">
        <AppSidebar className="h-screen" />
      </div>

      <Drawer
        open={isMobileSidebarOpen}
        onClose={closeMobileSidebar}
        placement="left"
        width={288}
        closeIcon={null}
        styles={{
          header: { display: 'none' },
          body: { padding: 0 },
        }}
      >
        <AppSidebar className="min-h-full" onNavigate={closeMobileSidebar} />
      </Drawer>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={openMobileSidebar}
            className="flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-200/70 transition hover:border-slate-300"
            aria-label="Mở menu điều hướng"
          >
            <MenuOutlined />
          </button>
          <AppShellBrand compact />
          <AppUserMenu compact />
        </header>

        <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
