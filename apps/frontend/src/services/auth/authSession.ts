import { tokenStorage } from './tokenStorage';
import { PUBLIC_AUTH_ROUTES } from './authConstants';

/**
 * Auth session helpers — quản lý trạng thái phiên đăng nhập.
 *
 * Lưu ý kiến trúc:
 * - Module này chỉ quản lý session state (token, redirect logic).
 * - KHÔNG chứa API calls — API calls nằm trong feature auth hooks.
 * - Được sử dụng bởi HTTP interceptors và route guards.
 */

export const authSession = {
  /** Kiểm tra user có token (đã đăng nhập chưa) */
  isAuthenticated(): boolean {
    return tokenStorage.hasToken();
  },

  /** Lưu session sau khi login thành công */
  saveSession(accessToken: string): void {
    tokenStorage.setToken(accessToken);
  },

  /**
   * Xoá session — dùng khi logout hoặc khi nhận 401.
   *
   * Chỉ xoá token, KHÔNG redirect ở đây.
   * Lý do: tránh side-effect không kiểm soát được —
   * redirect logic nằm ở interceptor hoặc ProtectedRoute.
   */
  clearSession(): void {
    tokenStorage.removeToken();
  },

  /**
   * Kiểm tra pathname hiện tại có phải route công khai (auth) không.
   *
   * VÌ SAO CẦN HÀM NÀY:
   * Khi interceptor nhận 401, nếu user đang ở /login thì KHÔNG redirect,
   * tránh tạo vòng lặp redirect vô tận (login → 401 → login → 401...).
   *
   * Ví dụ: POST /auth/login trả 401 (sai password) → không nên redirect
   * vì user đã ở trang login rồi.
   */
  isOnPublicAuthRoute(): boolean {
    const { pathname } = window.location;
    return PUBLIC_AUTH_ROUTES.some((route) => pathname.startsWith(route));
  },

  /**
   * Xử lý khi phiên hết hạn (401 từ server).
   *
   * CÁCH TRÁNH REDIRECT LOOP:
   * 1. Xoá token trước
   * 2. Kiểm tra có đang ở trang auth không → nếu có thì DỪNG
   * 3. Chỉ redirect khi user đang ở trang protected
   * 4. Lưu đường dẫn hiện tại vào redirect param để quay lại sau login
   *
   * Tích hợp sau với ProtectedRoute / AuthProvider:
   * - Khi có AuthProvider, có thể gọi provider.logout() thay vì redirect cứng
   * - Module này thiết kế để dễ chuyển sang event-based approach
   */
  handleUnauthorized(): void {
    this.clearSession();

    // Không redirect nếu đang ở trang auth (tránh redirect loop)
    if (this.isOnPublicAuthRoute()) {
      return;
    }

    // Lưu current path để redirect lại sau login
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl =
      currentPath && currentPath !== '/'
        ? `/login?redirect=${encodeURIComponent(currentPath)}`
        : '/login';

    window.location.href = loginUrl;
  },
};
