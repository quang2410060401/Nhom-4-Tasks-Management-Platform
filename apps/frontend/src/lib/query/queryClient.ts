import { QueryClient, type DefaultOptions } from '@tanstack/react-query';

/* ─────────────────────────────────────────────────────────────────
 * QueryClient — cấu hình TanStack Query cho toàn bộ ứng dụng
 * ─────────────────────────────────────────────────────────────────
 * Nguyên tắc:
 * - Server state nằm HOÀN TOÀN trong TanStack Query.
 * - KHÔNG duplicate query data sang Zustand (trừ khi có lý do rõ ràng).
 * - Zustand chỉ dùng cho UI state (modal, drawer, filter, sidebar...).
 *
 * Retry strategy cho auth/business APIs:
 * - Không retry 401/403 — đây là lỗi nghiệp vụ, retry vô nghĩa.
 * - Retry các lỗi khác tối đa 1 lần (network glitch, 500 tạm thời).
 *
 * onError hooks (queries/mutations) để trống dạng no-op.
 * Khi tích hợp Ant Design message/notification toàn cục,
 * chỉ cần cập nhật ở đây — tất cả queries/mutations sẽ kế thừa.
 * ───────────────────────────────────────────────────────────────── */

/**
 * Retry callback — không retry lỗi auth/permission (401, 403).
 * Các lỗi khác retry tối đa 1 lần.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  // Lỗi 401/403 là lỗi nghiệp vụ — retry không giải quyết được
  if (isHttpStatus(error, 401) || isHttpStatus(error, 403)) {
    return false;
  }
  // Lỗi 404 cũng không nên retry
  if (isHttpStatus(error, 404)) {
    return false;
  }
  return failureCount < 1;
}

/** Kiểm tra HTTP status từ AxiosError-like shape */
function isHttpStatus(error: unknown, status: number): boolean {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as Record<string, unknown>).response === 'object'
  ) {
    const response = (error as { response: { status?: number } }).response;
    return response?.status === status;
  }
  return false;
}

const queryDefaults: DefaultOptions = {
  queries: {
    retry: shouldRetry,
    /**
     * staleTime: 30s — data vẫn "tươi" trong 30s, tránh refetch quá nhiều.
     * Phù hợp cho MVP: board data, dashboard, group list refresh nhẹ nhàng.
     */
    staleTime: 30 * 1000,
    /**
     * gcTime (garbage collection): 5 phút.
     * Cache data giữ lại 5 phút sau khi không còn observer nào subscribe.
     * Giúp navigate qua lại giữa các trang mà không fetch lại ngay.
     */
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: false,
    /**
     * Mutation onError hook — placeholder cho global error feedback.
     * Khi tích hợp Ant Design `message.error()` hoặc `notification`,
     * cập nhật ở đây để mọi mutation đều tự hiển thị lỗi.
     *
     * Hiện tại để no-op — feature hooks tự xử lý lỗi cục bộ.
     */
    // onError: (error) => { /* future: global error toast */ },
  },
};

export const queryClient = new QueryClient({
  defaultOptions: queryDefaults,
});
