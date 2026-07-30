import { ROUTES, QUERY_PARAMS } from '@/lib/constants/routes';
import { buildQueryString } from './queryString';

const PENDING_REDIRECT_STORAGE_KEY = 'tmp_redirect_after_auth';

/* ─────────────────────────────────────────────────────────────────
 * Navigation Helpers — utility cho redirect & URL building
 * ─────────────────────────────────────────────────────────────────
 * QUAN TRỌNG — LUỒNG INVITE ACCEPTANCE:
 *
 * Khi user chưa đăng nhập mà truy cập link invite:
 *   /invite/accept?token=abc123
 *
 * Frontend cần redirect sang login và GIỮ LẠI toàn bộ path + query:
 *   /login?redirect=/invite/accept?token=abc123
 *
 * Sau khi login thành công, frontend ĐỌC redirect param và navigate
 * về đó để tiếp tục luồng accept invite.
 *
 * Xem: system-flows.md — Flow 5, bước (12)-(14)
 *
 * VÌ SAO ENCODE REDIRECT:
 * Redirect path có thể chứa ký tự đặc biệt (?, &, =).
 * Ví dụ: /invite/accept?token=abc123
 * Nếu không encode, browser sẽ parse sai query params.
 * → Dùng encodeURIComponent cho redirect value.
 * ───────────────────────────────────────────────────────────────── */

/**
 * Tạo URL login có redirect param — dùng khi redirect user chưa auth.
 *
 * Trường hợp sử dụng:
 * - Route guard phát hiện user chưa login → redirect login + preserve return path
 * - User mở invite link chưa login → login rồi quay lại accept invite
 *
 * @param returnTo — đường dẫn cần quay lại sau login (bao gồm query params)
 *
 * @example
 * ```ts
 * // User chưa login, đang ở /groups/abc
 * buildLoginRedirectUrl('/groups/abc')
 * // → '/login?redirect=%2Fgroups%2Fabc'
 *
 * // User mở invite link chưa login
 * buildLoginRedirectUrl('/invite/accept?token=xyz')
 * // → '/login?redirect=%2Finvite%2Faccept%3Ftoken%3Dxyz'
 * ```
 */
export function buildLoginRedirectUrl(returnTo: string): string {
  const normalizedReturnTo = returnTo.trim();

  // Không cần redirect param cho các đường dẫn mặc định sau login.
  if (
    !normalizedReturnTo ||
    normalizedReturnTo === ROUTES.HOME ||
    normalizedReturnTo === ROUTES.DASHBOARD
  ) {
    return ROUTES.LOGIN;
  }

  return `${ROUTES.LOGIN}${buildQueryString({ [QUERY_PARAMS.REDIRECT]: normalizedReturnTo })}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function savePendingRedirectPath(path: string | null): void {
  if (!canUseStorage()) {
    return;
  }

  if (!path) {
    window.localStorage.removeItem(PENDING_REDIRECT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(PENDING_REDIRECT_STORAGE_KEY, path);
}

export function loadPendingRedirectPath(): string | null {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(PENDING_REDIRECT_STORAGE_KEY);
}

export function consumePendingRedirectPath(): string | null {
  const path = loadPendingRedirectPath();
  savePendingRedirectPath(null);
  return path;
}

/**
 * Tạo URL invite accept — từ invite token.
 *
 * Dùng khi cần xây dựng lại invite URL phía frontend
 * (ví dụ: sau login, cần navigate đến invite accept page).
 *
 * @example
 * ```ts
 * buildInviteAcceptUrl('abc-123-def')
 * // → '/invite/accept?token=abc-123-def'
 * ```
 */
export function buildInviteAcceptUrl(token: string): string {
  return `${ROUTES.INVITE_ACCEPT}${buildQueryString({ [QUERY_PARAMS.TOKEN]: token })}`;
}

/**
 * Trích xuất redirect path từ URL search string hiện tại.
 *
 * Dùng sau khi login thành công để biết cần navigate đi đâu.
 * Trả null nếu không có redirect param → caller tự quyết default.
 *
 * @example
 * ```ts
 * // URL hiện tại: /login?redirect=%2Finvite%2Faccept%3Ftoken%3Dxyz
 * extractRedirectPath(location.search)
 * // → '/invite/accept?token=xyz'
 * ```
 */
export function extractRedirectPath(search: string): string | null {
  const params = new URLSearchParams(search);
  return params.get(QUERY_PARAMS.REDIRECT);
}

/**
 * Lấy full current path + search — dùng khi cần preserve URL hiện tại.
 *
 * Ví dụ route guard lưu lại URL trước khi redirect sang login.
 */
export function getCurrentPathWithSearch(pathname: string, search: string): string {
  return `${pathname}${search}`;
}
