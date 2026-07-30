import axios from 'axios';
import type { AxiosError } from 'axios';
import type { ApiErrorResponse, ApiAxiosResponse, NormalizedApiError } from './httpTypes';
import { DEFAULT_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from '@/services/auth/authConstants';

/* ─────────────────────────────────────────────────────────────────
 * HTTP Helpers — xử lý response và error chung
 * ─────────────────────────────────────────────────────────────────
 * VÌ SAO CẦN NORMALIZE LỖI:
 *
 * Backend trả error dưới nhiều dạng:
 * - { message: "string" }          → lỗi đơn
 * - { message: ["string", ...] }   → validation errors (NestJS pipe)
 * - Network error                  → không có response
 * - Timeout                        → request bị huỷ
 *
 * UI KHÔNG nên xử lý từng dạng riêng.
 * Thay vào đó, normalize tất cả thành NormalizedApiError
 * rồi UI chỉ cần đọc .message và các flag (.isUnauthorized, v.v.)
 *
 * MAPPING SERVER CONTRACT → UI:
 * Nếu cần đổi tên field từ backend cho UI (vd: statusId → status),
 * KHÔNG đổi ở đây. Đổi trong feature hooks hoặc API adapters,
 * giữ transport layer sát với backend contract.
 * Xem: frontend.instructions.md → API integration rules
 * ───────────────────────────────────────────────────────────────── */

/**
 * Unwrap response — lấy `data` từ standard ApiResponse wrapper.
 *
 * Backend luôn trả: `{ statusCode, message, data }`.
 * Hàm này bóc lớp Axios response rồi bóc lớp API wrapper,
 * trả thẳng payload cho caller.
 *
 * @example
 * ```ts
 * const user = await unwrapResponse(apiClient.get<ApiResponse<User>>('/auth/me'));
 * // user là User, không phải AxiosResponse<ApiResponse<User>>
 * ```
 */
export function unwrapResponse<T>(responsePromise: Promise<ApiAxiosResponse<T>>): Promise<T> {
  return responsePromise.then((res) => res.data.data);
}

/**
 * Normalize bất kỳ error nào thành NormalizedApiError
 * để UI hiển thị an toàn, không lộ raw backend objects.
 */
export function normalizeApiError(error: unknown): NormalizedApiError {
  // Axios error — có response từ server
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorResponse>;

    // Network error (server không phản hồi)
    if (!axiosErr.response) {
      return {
        statusCode: 0,
        message: NETWORK_ERROR_MESSAGE,
        isNetworkError: true,
        isUnauthorized: false,
        isForbidden: false,
      };
    }

    const { status, data } = axiosErr.response;
    const rawMessage = data?.message;

    // Backend có thể trả message dạng string hoặc string[] (NestJS validation pipe)
    let message: string;
    let validationErrors: string[] | undefined;

    if (Array.isArray(rawMessage)) {
      validationErrors = rawMessage;
      message = rawMessage[0] ?? DEFAULT_ERROR_MESSAGE;
    } else {
      message = typeof rawMessage === 'string' ? rawMessage : DEFAULT_ERROR_MESSAGE;
    }

    return {
      statusCode: status,
      message,
      error: data?.error,
      validationErrors,
      isNetworkError: false,
      isUnauthorized: status === 401,
      isForbidden: status === 403,
    };
  }

  // Cancelled request (AbortController)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      statusCode: 0,
      message: 'Yêu cầu đã bị huỷ',
      isNetworkError: false,
      isUnauthorized: false,
      isForbidden: false,
    };
  }

  // Fallback — lỗi không xác định
  return {
    statusCode: 0,
    message: DEFAULT_ERROR_MESSAGE,
    isNetworkError: false,
    isUnauthorized: false,
    isForbidden: false,
  };
}

/**
 * Helper lấy message an toàn từ error để hiển thị cho user.
 * Dùng nhanh trong catch block khi không cần full NormalizedApiError.
 *
 * @example
 * ```ts
 * try { ... } catch (err) {
 *   message.error(getErrorMessage(err));
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  return normalizeApiError(error).message;
}

/**
 * Type guard — kiểm tra error có phải Axios error không.
 * Dùng khi cần truy cập response data gốc.
 */
export function isApiError(error: unknown): error is AxiosError<ApiErrorResponse> {
  return axios.isAxiosError(error);
}
