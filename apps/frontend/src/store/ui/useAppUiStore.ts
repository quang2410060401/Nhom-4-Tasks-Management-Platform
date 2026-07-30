import { create } from 'zustand';

/* ─────────────────────────────────────────────────────────────────
 * useAppUiStore — UI state toàn cục cho app shell
 * ─────────────────────────────────────────────────────────────────
 * VÌ SAO CHỈ LƯU UI STATE Ở ĐÂY:
 *
 * Zustand chỉ quản lý trạng thái GIAO DIỆN (sidebar, modal, overlay...).
 * Server data (user profile, groups, tasks...) nằm trong TanStack Query.
 *
 * Tách biệt này giúp:
 * 1. Tránh stale data — TanStack Query tự quản lý cache/invalidation.
 *    Nếu copy server data sang Zustand, phải tự đồng bộ → dễ bị lệch.
 * 2. Dễ maintain — UI state thay đổi ngay, server state qua API.
 * 3. Tránh rerender thừa — component chỉ subscribe state nó cần.
 *
 * KHÔNG lưu: user profile, groups list, tasks, statuses, labels...
 * Những data đó dùng useQuery() từ TanStack Query.
 * ───────────────────────────────────────────────────────────────── */

// ──── State types ────

interface AppUiState {
  /** Sidebar thu gọn hay mở rộng */
  sidebarCollapsed: boolean;
  /** Drawer sidebar trên mobile đang mở hay đóng */
  mobileSidebarOpen: boolean;
  /** Global loading overlay (dùng cho navigation chuyển trang nặng) */
  globalLoading: boolean;
}

interface AppUiActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setGlobalLoading: (loading: boolean) => void;
}

// ──── Store ────

export const useAppUiStore = create<AppUiState & AppUiActions>((set) => ({
  // State
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  globalLoading: false,

  // Actions
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));

// ──── Selectors (tránh rerender khi chỉ cần 1 field) ────

export const selectSidebarCollapsed = (s: AppUiState & AppUiActions) => s.sidebarCollapsed;
export const selectMobileSidebarOpen = (s: AppUiState & AppUiActions) => s.mobileSidebarOpen;
export const selectGlobalLoading = (s: AppUiState & AppUiActions) => s.globalLoading;
