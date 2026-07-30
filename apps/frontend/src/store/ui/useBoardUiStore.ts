import { create } from 'zustand';

/* ─────────────────────────────────────────────────────────────────
 * useBoardUiStore — UI state cho Kanban board & task drawer
 * ─────────────────────────────────────────────────────────────────
 * QUAN TRỌNG — PHÂN BIỆT SERVER STATE vs UI STATE:
 *
 * Store này KHÔNG chứa dữ liệu tasks, statuses, labels từ backend.
 * Những data đó nằm trong TanStack Query (useQuery + queryKeys).
 *
 * Store này chỉ quản lý:
 * - Task nào đang được chọn (để mở drawer chi tiết)
 * - Drawer đang mở/đóng
 * - Filter UI values (assigneeId, labelIds, search)
 * - Group nào đang active trên board (context presentational)
 * - Invite modal visibility
 *
 * VÌ SAO FILTER Ở ĐÂY MÀ KHÔNG Ở TANSTACK QUERY:
 * Filter values là INPUT của user trên UI → điều khiển queryKey.
 * TanStack Query nhận filter qua queryKey để fetch đúng data.
 * Zustand giữ filter values, TanStack Query giữ filtered results.
 *
 * KANBAN STATUSES LÀ DYNAMIC:
 * Board columns được tạo từ statuses trả về từ API,
 * KHÔNG hardcode Todo/Doing/Done. Xem api-specification.md §4.2.
 * ───────────────────────────────────────────────────────────────── */

// ──── State types ────

export interface BoardFilters {
  /** Lọc task theo người được giao — null = tất cả */
  assigneeId: string | null;
  /** Lọc task theo labels — mảng rỗng = tất cả */
  labelIds: string[];
  /** Tìm task theo tiêu đề */
  search: string;
}

interface BoardUiState {
  /** Group đang hiển thị trên board (presentational context) */
  activeGroupId: string | null;
  /** Task đang được chọn để xem chi tiết */
  selectedTaskId: string | null;
  /** Task detail drawer đang mở */
  isTaskDrawerOpen: boolean;
  /** Filter values cho board — điều khiển query params */
  filters: BoardFilters;
  /** Invite member modal đang mở */
  isInviteModalOpen: boolean;
}

interface BoardUiActions {
  setActiveGroupId: (groupId: string | null) => void;

  /** Mở drawer chi tiết task — set taskId + mở drawer */
  openTaskDrawer: (taskId: string) => void;
  /** Đóng drawer — xoá selectedTaskId */
  closeTaskDrawer: () => void;

  /** Cập nhật filter — chỉ thay đổi field được truyền */
  setFilters: (partial: Partial<BoardFilters>) => void;
  /** Reset tất cả filter về mặc định */
  resetFilters: () => void;

  openInviteModal: () => void;
  closeInviteModal: () => void;
}

// ──── Default values ────

const DEFAULT_FILTERS: BoardFilters = {
  assigneeId: null,
  labelIds: [],
  search: '',
};

// ──── Store ────

export const useBoardUiStore = create<BoardUiState & BoardUiActions>((set) => ({
  // State
  activeGroupId: null,
  selectedTaskId: null,
  isTaskDrawerOpen: false,
  filters: { ...DEFAULT_FILTERS },
  isInviteModalOpen: false,

  // Actions
  setActiveGroupId: (groupId) => set({ activeGroupId: groupId }),

  openTaskDrawer: (taskId) => set({ selectedTaskId: taskId, isTaskDrawerOpen: true }),
  closeTaskDrawer: () => set({ selectedTaskId: null, isTaskDrawerOpen: false }),

  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  openInviteModal: () => set({ isInviteModalOpen: true }),
  closeInviteModal: () => set({ isInviteModalOpen: false }),
}));

// ──── Selectors (subscribe chính xác, tránh rerender thừa) ────

export const selectActiveGroupId = (s: BoardUiState & BoardUiActions) => s.activeGroupId;
export const selectSelectedTaskId = (s: BoardUiState & BoardUiActions) => s.selectedTaskId;
export const selectIsTaskDrawerOpen = (s: BoardUiState & BoardUiActions) => s.isTaskDrawerOpen;
export const selectBoardFilters = (s: BoardUiState & BoardUiActions) => s.filters;
export const selectIsInviteModalOpen = (s: BoardUiState & BoardUiActions) => s.isInviteModalOpen;
