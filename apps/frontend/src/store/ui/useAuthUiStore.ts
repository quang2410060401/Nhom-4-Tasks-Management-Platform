import { create } from 'zustand';

/* ─────────────────────────────────────────────────────────────────
 * useAuthUiStore — UI state cho luồng authentication
 * ─────────────────────────────────────────────────────────────────
 * Store này quản lý:
 * - Redirect path sau khi login (ví dụ: accept invite link)
 * - Auth form loading states (phân biệt với server fetching)
 *
 * User data (profile, token) KHÔNG nằm ở đây:
 * - Token → tokenStorage (localStorage)
 * - Profile → TanStack Query (authKeys.me)
 * ───────────────────────────────────────────────────────────────── */

// ──── State types ────

interface AuthUiState {
  /** Đường dẫn redirect sau khi login xong — ví dụ invite link */
  redirectAfterLogin: string | null;
  /** Auth form đang submit (login/register/forgot/reset) */
  isSubmitting: boolean;
}

interface AuthUiActions {
  /** Lưu đường dẫn cần redirect sau khi login thành công */
  setRedirectAfterLogin: (path: string | null) => void;
  /** Lấy + xoá redirect path (consume 1 lần) */
  consumeRedirectPath: () => string | null;
  setIsSubmitting: (loading: boolean) => void;
}

// ──── Store ────

export const useAuthUiStore = create<AuthUiState & AuthUiActions>((set, get) => ({
  // State
  redirectAfterLogin: null,
  isSubmitting: false,

  // Actions
  setRedirectAfterLogin: (path) => set({ redirectAfterLogin: path }),
  consumeRedirectPath: () => {
    const path = get().redirectAfterLogin;
    set({ redirectAfterLogin: null });
    return path;
  },
  setIsSubmitting: (loading) => set({ isSubmitting: loading }),
}));

// ──── Selectors ────

export const selectRedirectAfterLogin = (s: AuthUiState & AuthUiActions) => s.redirectAfterLogin;
export const selectIsAuthSubmitting = (s: AuthUiState & AuthUiActions) => s.isSubmitting;
