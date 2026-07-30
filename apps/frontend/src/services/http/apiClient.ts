import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { tokenStorage } from '@/services/auth/tokenStorage';
import { authSession } from '@/services/auth/authSession';

/* ─────────────────────────────────────────────────────────────────
 * API Client — Axios instance dùng chung cho toàn bộ ứng dụng
 * ─────────────────────────────────────────────────────────────────
 * Mọi HTTP request đến backend NÊN đi qua instance này.
 *
 * Chức năng:
 * 1. Base URL từ biến môi trường (VITE_API_BASE_URL)
 * 2. Tự động gắn Bearer token vào Authorization header
 * 3. Xử lý 401 — xoá session, redirect login (tránh loop)
 * 4. Hỗ trợ request cancellation qua AbortController
 *
 * Lưu ý:
 * - KHÔNG unwrap response ở interceptor — giữ nguyên AxiosResponse
 *   để feature code có thể dùng unwrapResponse() khi cần,
 *   hoặc đọc statusCode/message nếu muốn.
 * - Transport field names giữ NGUYÊN từ backend contract.
 *   Xem: httpTypes.ts header comment.
 * ───────────────────────────────────────────────────────────────── */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

/* ───── Request interceptor — gắn access token ───── */
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ───── Response interceptor — xử lý 401 ─────
 *
 * VÌ SAO PHẢI TRÁNH REDIRECT LOOP:
 * Nếu user đang ở /login và gửi POST /auth/login bị trả 401 (sai password),
 * interceptor cũ sẽ xoá token rồi redirect sang /login — tạo loop.
 *
 * Giải pháp:
 * - Dùng authSession.handleUnauthorized() — đã có logic kiểm tra
 *   isOnPublicAuthRoute() trước khi redirect.
 * - Chỉ redirect khi user đang ở trang protected, không phải auth pages.
 *
 * TÍCH HỢP VỚI PROTECTEDROUTE / AUTHPROVIDER SAU:
 * Khi có AuthProvider với context và event, có thể chuyển từ
 * window.location.href sang provider.handleSessionExpired().
 * authSession module thiết kế tách biệt để dễ swap.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      authSession.handleUnauthorized();
    }
    return Promise.reject(error);
  },
);

/**
 * Tạo AbortController cho request cancellation.
 *
 * Dùng khi cần huỷ request (vd: component unmount, search debounce).
 *
 * @example
 * ```ts
 * const { signal, cancel } = createCancelToken();
 * apiClient.get('/tasks', { signal });
 * // Khi không cần nữa:
 * cancel();
 * ```
 */
export function createCancelToken(): {
  signal: AbortSignal;
  cancel: () => void;
} {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

/**
 * Helper gọi GET có sẵn cancel support.
 * Trả thêm cancel function cùng với promise.
 */
export function cancellableGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): { promise: Promise<T>; cancel: () => void } {
  const { signal, cancel } = createCancelToken();
  const promise = apiClient.get<T>(url, { ...config, signal }).then((res) => res.data);
  return { promise, cancel };
}

export { apiClient };
