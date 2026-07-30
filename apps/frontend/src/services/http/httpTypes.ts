import type { AxiosError, AxiosResponse } from 'axios';

/* ─────────────────────────────────────────────────────────────────
 * HTTP & API Types
 * ─────────────────────────────────────────────────────────────────
 * QUAN TRỌNG — GIỮ NGUYÊNTÊN FIELD TỪ BACKEND:
 *
 * Các interface transport ở đây phản ánh ĐÚNG shape trả về từ API.
 * Không đổi tên field (vd: creatorId → createdBy, inviteToken → token).
 *
 * Lý do:
 * 1. Giảm confusion khi debug — network tab và code dùng cùng tên.
 * 2. Tránh mapping thừa ở transport layer.
 * 3. Nếu cần tên khác cho UI, map TRONG feature hook/adapter,
 *    không phải ở shared transport types.
 *
 * Xem thêm: .github/docs/api-specification.md — Response Format
 * ───────────────────────────────────────────────────────────────── */

/**
 * Response wrapper chuẩn từ backend (tất cả endpoint dùng chung shape này).
 *
 * ```json
 * { "statusCode": 200, "message": "Success", "data": { ... } }
 * ```
 */
export interface ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  data: T;
}

/**
 * Error response từ backend.
 *
 * ```json
 * { "statusCode": 400, "message": "Email đã tồn tại", "error": "Bad Request" }
 * ```
 */
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

/** Pagination meta trả về từ paginated endpoints */
export interface PaginationMeta {
  totalItems: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

/** Paginated data wrapper */
export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

/** Query params cho paginated requests */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * Normalized API error — dạng đã xử lý, an toàn để hiển thị cho user.
 * UI layers chỉ nên dùng type này, KHÔNG dùng raw AxiosError.
 */
export interface NormalizedApiError {
  /** HTTP status code (400, 401, 403, 404, 500...) hoặc 0 nếu network error */
  statusCode: number;
  /** Message an toàn để hiển thị cho user */
  message: string;
  /** Tên lỗi HTTP nếu có (Bad Request, Unauthorized...) */
  error?: string;
  /** Danh sách validation messages nếu backend trả array */
  validationErrors?: string[];
  /** Flag cho biết có phải lỗi mạng (không kết nối server) */
  isNetworkError: boolean;
  /** Flag cho biết có phải 401 (cần re-login) */
  isUnauthorized: boolean;
  /** Flag cho biết có phải 403 (không đủ quyền) */
  isForbidden: boolean;
}

/** Type alias cho AxiosError chứa backend error response */
export type ApiAxiosError = AxiosError<ApiErrorResponse>;

/** Type alias cho AxiosResponse chứa standard API response */
export type ApiAxiosResponse<T = unknown> = AxiosResponse<ApiResponse<T>>;
