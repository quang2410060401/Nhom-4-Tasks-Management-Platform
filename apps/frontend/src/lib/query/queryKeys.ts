/* ─────────────────────────────────────────────────────────────────
 * Query Key Factories — typed, stable, hierarchical
 * ─────────────────────────────────────────────────────────────────
 * Quy tắc:
 * 1. Mỗi domain entity có namespace riêng.
 * 2. Key theo mô hình phân cấp: [scope] → [scope, action] → [scope, action, params]
 *    Giúp invalidate từ rộng đến hẹp:
 *    - invalidate ['groups'] → xoá cache toàn bộ groups
 *    - invalidate ['groups', 'detail', groupId] → chỉ xoá 1 group detail
 * 3. Group-scoped resources (tasks, statuses, labels, dashboard, members)
 *    luôn chứa groupId để invalidate theo group dễ dàng.
 *
 * KHÔNG duplicate server data sang Zustand.
 * Tất cả query keys ở đây là nguồn duy nhất cho TanStack Query cache.
 * ───────────────────────────────────────────────────────────────── */

// ──── Auth ────
export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
} as const;

// ──── Groups ────
export const groupKeys = {
  all: ['groups'] as const,
  list: (params?: Record<string, unknown>) => [...groupKeys.all, 'list', params] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
  statusPresets: (params?: Record<string, unknown>) =>
    [...groupKeys.all, 'status-presets', params] as const,
  labelPresets: (params?: Record<string, unknown>) =>
    [...groupKeys.all, 'label-presets', params] as const,
  memberCandidates: (params?: Record<string, unknown>) =>
    [...groupKeys.all, 'member-candidates', params] as const,
} as const;

// ──── Group Members ────
export const memberKeys = {
  all: (groupId: string) => ['groups', groupId, 'members'] as const,
  list: (groupId: string) => [...memberKeys.all(groupId), 'list'] as const,
} as const;

// ──── Group Invites ────
export const inviteKeys = {
  all: (groupId: string) => ['groups', groupId, 'invites'] as const,
} as const;

/* ──── Tasks ────
 *
 * QUAN TRỌNG — KANBAN STATUSES LÀ DYNAMIC:
 * Backend trả tasks kèm statuses (GET /groups/:groupId/tasks).
 * Response shape: { statuses: [{ _id, name, slug, color, order, tasks: [...] }] }
 *
 * KHÔNG hardcode columns Todo/Doing/Done.
 * Render columns dựa trên statuses trả về, sort theo `order`.
 * Task movement dựa trên `statusId`, không phải tên cột.
 */
export const taskKeys = {
  all: (groupId: string) => ['groups', groupId, 'tasks'] as const,
  /** Board view — query key cho GET /groups/:groupId/tasks (Kanban) */
  board: (groupId: string, filters?: Record<string, unknown>) =>
    [...taskKeys.all(groupId), 'board', filters] as const,
  list: (groupId: string, filters?: Record<string, unknown>) =>
    [...taskKeys.all(groupId), 'list', filters] as const,
  detail: (groupId: string, taskId: string) =>
    [...taskKeys.all(groupId), 'detail', taskId] as const,
  comments: (groupId: string, taskId: string) =>
    [...taskKeys.all(groupId), 'comments', taskId] as const,
  myAll: ['tasks', 'my'] as const,
  my: (filters?: Record<string, unknown>) => [...taskKeys.myAll, 'list', filters] as const,
} as const;

/* ──── Statuses ────
 *
 * Statuses là DYNAMIC per group — mỗi group có bộ statuses riêng.
 * Metadata quan trọng: _id, name, slug, color, order, isDefault, isCompleted.
 * Kanban columns và dashboard breakdown đều dựa trên statuses.
 */
export const statusKeys = {
  all: (groupId: string) => ['groups', groupId, 'statuses'] as const,
  list: (groupId: string) => [...statusKeys.all(groupId), 'list'] as const,
} as const;

// ──── Labels ────
export const labelKeys = {
  all: (groupId: string) => ['groups', groupId, 'labels'] as const,
  list: (groupId: string) => [...labelKeys.all(groupId), 'list'] as const,
} as const;

/* ──── Dashboard ────
 *
 * QUAN TRỌNG — DASHBOARD LÀ DYNAMIC:
 * Backend trả statusBreakdown dạng mảng — đếm theo từng status thực tế.
 * completionRate dựa vào isCompleted, KHÔNG hardcode theo tên "Done".
 *
 * KHÔNG hardcode dashboard counters cho Todo/Doing/Done.
 * Luôn render từ statusBreakdown trả về.
 */
export const dashboardKeys = {
  me: () => ['dashboard', 'me'] as const,
  all: (groupId: string) => ['groups', groupId, 'dashboard'] as const,
  summary: (groupId: string) => [...dashboardKeys.all(groupId), 'summary'] as const,
} as const;

/* ─────────────────────────────────────────────────────────────────
 * queryKeys — unified namespace re-export
 * ─────────────────────────────────────────────────────────────────
 * Dùng khi muốn import tất cả key factories qua 1 object:
 *   import { queryKeys } from '@/lib/query';
 *   queryClient.invalidateQueries({ queryKey: queryKeys.tasks.board(groupId) });
 */
export const queryKeys = {
  auth: authKeys,
  groups: groupKeys,
  members: memberKeys,
  invites: inviteKeys,
  tasks: taskKeys,
  statuses: statusKeys,
  labels: labelKeys,
  dashboard: dashboardKeys,
} as const;
