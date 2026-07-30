import { Suspense, lazy, type ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/layout/AppLayout';
import { AuthLayout } from '@/app/layout/AuthLayout';
import { AppLoading } from '@/components';
import { ROUTES } from '@/lib/constants/routes';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const GroupsPage = lazy(() => import('@/pages/GroupsPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const MyTasksPage = lazy(() => import('@/pages/MyTasksPage'));
const GroupDetailPage = lazy(() => import('@/pages/GroupDetailPage'));
const GroupMembersPage = lazy(() => import('@/pages/GroupMembersPage'));
const GroupOverviewPage = lazy(() => import('@/pages/GroupOverviewPage'));
const GroupTasksPage = lazy(() => import('@/pages/GroupTasksPage'));
const InviteAcceptPage = lazy(() => import('@/pages/InviteAcceptPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

function withRouteSuspense(element: ReactNode) {
  return (
    <Suspense fallback={<AppLoading fullscreen tip="Đang tải trang..." />}>
      {element}
    </Suspense>
  );
}

/**
 * Router chính của ứng dụng.
 *
 * Cấu trúc:
 * - /login, /register, /verify-email, /forgot-password, /reset-password → AuthLayout (public)
 * - /dashboard, /groups/* → AppLayout (cần đăng nhập)
 * - /invite/accept?token=xxx → route riêng, tự xử lý trạng thái public/auth
 * - * → 404
 *
 * LƯU Ý QUAN TRỌNG — LUỒNG INVITE ACCEPTANCE:
 * Route /invite/accept?token=xxx là public-aware:
 * - chưa login → page hiển thị CTA login/register và preserve redirect
 * - đã login đúng tài khoản → auto accept
 * - đã login sai tài khoản → hiển thị CTA đổi tài khoản
 * Xem: system-flows.md — Flow 5, bước (11)-(14) & (20)
 */
export const router = createBrowserRouter([
  { path: ROUTES.INVITE_ACCEPT, element: withRouteSuspense(<InviteAcceptPage />) },
  {
    element: <AuthLayout />,
    children: [
      { path: ROUTES.LOGIN, element: withRouteSuspense(<LoginPage />) },
      { path: ROUTES.REGISTER, element: withRouteSuspense(<RegisterPage />) },
      { path: ROUTES.VERIFY_EMAIL, element: withRouteSuspense(<VerifyEmailPage />) },
      { path: ROUTES.FORGOT_PASSWORD, element: withRouteSuspense(<ForgotPasswordPage />) },
      { path: ROUTES.RESET_PASSWORD, element: withRouteSuspense(<ResetPasswordPage />) },
    ],
  },
  {
    element: <AppLayout />,
    children: [
      { path: ROUTES.HOME, element: withRouteSuspense(<DashboardPage />) },
      { path: ROUTES.DASHBOARD, element: withRouteSuspense(<DashboardPage />) },
      { path: ROUTES.GROUPS, element: withRouteSuspense(<GroupsPage />) },
      { path: ROUTES.TASKS, element: withRouteSuspense(<TasksPage />) },
      { path: ROUTES.MY_TASKS, element: withRouteSuspense(<MyTasksPage />) },
      {
        path: ROUTES.GROUP_DETAIL,
        element: withRouteSuspense(<GroupDetailPage />),
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: 'overview', element: withRouteSuspense(<GroupOverviewPage />) },
          { path: 'tasks', element: withRouteSuspense(<GroupTasksPage />) },
          { path: 'members', element: withRouteSuspense(<GroupMembersPage />) },
        ],
      },
    ],
  },
  { path: '*', element: withRouteSuspense(<NotFoundPage />) },
]);
