/**
 * Auth constants — hằng số liên quan đến auth session.
 * Tập trung key names để tránh hardcode rải rác trong codebase.
 */

/** Key lưu access token trong localStorage */
export const TOKEN_STORAGE_KEY = 'accessToken';

/** Event nội bộ để đồng bộ auth state ngay trong cùng tab */
export const TOKEN_STORAGE_EVENT = 'auth-token-changed';

/** Các route công khai (không cần auth) — dùng để kiểm tra redirect loop */
export const PUBLIC_AUTH_ROUTES = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
] as const;

/**
 * Fallback message khi không lấy được message cụ thể từ backend.
 * Dùng cho error normalization — không hiển thị raw object cho user.
 */
export const DEFAULT_ERROR_MESSAGE = 'Đã xảy ra lỗi, vui lòng thử lại sau';

/** Fallback message cho network error (không kết nối được server) */
export const NETWORK_ERROR_MESSAGE = 'Không thể kết nối đến máy chủ, vui lòng kiểm tra mạng';
