import { RouterProvider } from 'react-router-dom';
import { QueryProvider, AntdProvider, AuthProvider } from '@/app/providers';
import { router } from '@/app/router';

/**
 * App root component — composition root cho toàn bộ ứng dụng.
 *
 * Thứ tự providers:
 * 1. AntdProvider — ConfigProvider cho Ant Design theme/locale
 * 2. QueryProvider — TanStack Query cho server state
 * 3. AuthProvider — xác định trạng thái đăng nhập, hiện spinner khi cần
 * 4. RouterProvider — React Router cho navigation
 */
export default function App() {
  return (
    <AntdProvider>
      <QueryProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryProvider>
    </AntdProvider>
  );
}
