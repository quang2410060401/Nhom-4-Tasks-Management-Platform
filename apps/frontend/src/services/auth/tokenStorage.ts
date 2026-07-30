import { TOKEN_STORAGE_EVENT, TOKEN_STORAGE_KEY } from './authConstants';

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function emitTokenChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOKEN_STORAGE_EVENT));
}

/**
 * Token storage — quản lý JWT access token trong localStorage.
 *
 * Tách riêng storage layer để:
 * - Dễ thay đổi storage backend sau (sessionStorage, cookie, etc.)
 * - Dễ mock trong unit test
 * - Tránh rải rác localStorage.getItem/setItem khắp codebase
 */

export const tokenStorage = {
  /** Lấy access token hiện tại, trả null nếu chưa đăng nhập */
  getToken(): string | null {
    return readToken();
  },

  /** Lưu access token sau khi đăng nhập thành công */
  setToken(token: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    emitTokenChanged();
  },

  /** Xoá access token (logout hoặc session hết hạn) */
  removeToken(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    emitTokenChanged();
  },

  /** Kiểm tra nhanh có token hay không — không validate JWT */
  hasToken(): boolean {
    return !!readToken();
  },

  /**
   * Subscribe token changes để React cập nhật auth guards ngay
   * khi login/logout trong cùng tab hoặc tab khác.
   */
  subscribe(onStoreChange: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined;

    const handleTokenChanged = () => onStoreChange();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TOKEN_STORAGE_KEY) {
        onStoreChange();
      }
    };

    window.addEventListener(TOKEN_STORAGE_EVENT, handleTokenChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(TOKEN_STORAGE_EVENT, handleTokenChanged);
      window.removeEventListener('storage', handleStorage);
    };
  },
};
