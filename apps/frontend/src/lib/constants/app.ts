/* ─────────────────────────────────────────────────────────────────
 * App Constants — cấu hình chung cho ứng dụng
 * ───────────────────────────────────────────────────────────────── */

/** Base URL cho API — đọc từ env, fallback /api/v1 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/** Tên ứng dụng — dùng cho document title, branding */
export const APP_NAME = 'Tasks Management Platform';

/** Pagination defaults — đồng bộ với backend (api-specification.md §1.3) */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;

/** Date format constants — dùng với dayjs */
export const DATE_FORMAT = {
  /** Hiển thị ngày: 12/03/2026 */
  DATE: 'DD/MM/YYYY',
  /** Hiển thị ngày + giờ: 12/03/2026 14:30 */
  DATETIME: 'DD/MM/YYYY HH:mm',
  /** Hiển thị giờ: 14:30 */
  TIME: 'HH:mm',
  /** ISO format để gửi lên backend */
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;
