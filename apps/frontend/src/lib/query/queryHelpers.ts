import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

/* ─────────────────────────────────────────────────────────────────
 * Query Helpers — invalidation, cache update, optimistic patterns
 * ─────────────────────────────────────────────────────────────────
 * Các helper dùng chung cho tất cả feature mutation hooks.
 * Feature hooks import helpers từ đây thay vì tự viết logic invalidation.
 *
 * NGUYÊN TẮC:
 * - Invalidate chính xác: chỉ invalidate queries bị ảnh hưởng bởi mutation.
 * - Tránh invalidate quá rộng (vd: invalidate tất cả cache) vì gây refetch thừa.
 * - Optimistic update PHẢI có rollback khi API thất bại.
 * ───────────────────────────────────────────────────────────────── */

// ─────────────────────────────────────
// Invalidation helpers
// ─────────────────────────────────────

/**
 * Invalidate toàn bộ queries thuộc 1 group.
 *
 * Dùng khi thay đổi lớn ảnh hưởng nhiều resource cùng lúc,
 * vd: xoá member (tasks bị unassign, member list thay đổi, dashboard cập nhật).
 */
export function invalidateGroupScope(qc: QueryClient, groupId: string) {
  return qc.invalidateQueries({ queryKey: ['groups', groupId] });
}

/**
 * Invalidate board (task list) + dashboard sau khi task mutation.
 *
 * Dùng cho: tạo/sửa/xoá task, drag-and-drop.
 * Board và dashboard đều phụ thuộc vào task data nên invalidate cặp đôi.
 */
export function invalidateTaskRelated(qc: QueryClient, groupId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.me() }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.myAll }),
  ]);
}

/**
 * Invalidate member list + group detail sau khi thay đổi membership.
 *
 * Dùng cho: mời member, accept invite, xoá member.
 * Khi xoá member → tasks bị unassign → cần invalidate cả board.
 */
export function invalidateMemberRelated(
  qc: QueryClient,
  groupId: string,
  options?: { includeTasks?: boolean },
) {
  const promises: Promise<void>[] = [
    qc.invalidateQueries({ queryKey: queryKeys.members.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.groups.all }),
  ];
  // Khi xoá member, task assignee thay đổi → cần refresh board
  if (options?.includeTasks) {
    promises.push(
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all(groupId) }),
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(groupId) }),
    );
  }
  return Promise.all(promises);
}

/**
 * Invalidate statuses + board + dashboard sau khi CRUD status.
 *
 * Statuses là cột Kanban → thay đổi status ảnh hưởng board layout.
 * Dashboard statusBreakdown cũng dựa trên statuses.
 */
export function invalidateStatusRelated(qc: QueryClient, groupId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.statuses.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard.all(groupId) }),
  ]);
}

/**
 * Invalidate labels sau khi CRUD label.
 * Tasks cũng cần refresh vì task cards hiển thị labels.
 */
export function invalidateLabelRelated(qc: QueryClient, groupId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.labels.all(groupId) }),
    qc.invalidateQueries({ queryKey: queryKeys.tasks.all(groupId) }),
  ]);
}

// ─────────────────────────────────────
// Optimistic update helpers
// ─────────────────────────────────────

/* VỀ OPTIMISTIC UPDATE:
 *
 * Optimistic update cho phép UI cập nhật NGAY LẬP TỨC trước khi có response.
 * Đặc biệt quan trọng cho Kanban drag-and-drop (kéo thả task giữa các cột).
 *
 * NGUYÊN TẮC BẮT BUỘC:
 * 1. Lưu snapshot data cũ trước khi update (để rollback).
 * 2. Cancel queries đang chạy (tránh overwrite optimistic data).
 * 3. Cập nhật cache ngay lập tức.
 * 4. Nếu API THẤT BẠI → rollback về snapshot cũ + thông báo user.
 * 5. Luôn invalidate sau cùng (onSettled) để đảm bảo data đúng.
 *
 * Pattern dưới đây là foundation — feature hooks sẽ dùng + tuỳ chỉnh.
 */

/**
 * Snapshot context trả về từ onMutate — chứa data cũ để rollback.
 */
export interface OptimisticContext<T = unknown> {
  /** Data cũ từ cache trước khi optimistic update */
  previousData: T | undefined;
  /** Query key đã update — dùng để rollback chính xác */
  queryKey: QueryKey;
}

/**
 * Chuẩn bị cho optimistic update: cancel queries + lấy snapshot.
 *
 * Dùng trong onMutate callback của useMutation.
 *
 * @example — Kanban drag-and-drop (feature hook sẽ implement):
 * ```ts
 * onMutate: async (variables) => {
 *   const key = queryKeys.tasks.board(groupId);
 *   const ctx = await prepareOptimisticUpdate<BoardData>(queryClient, key);
 *   // Cập nhật cache: di chuyển task sang status mới
 *   queryClient.setQueryData(key, (old) => moveBoardTask(old, variables));
 *   return ctx;
 * }
 * ```
 */
export async function prepareOptimisticUpdate<T>(
  qc: QueryClient,
  queryKey: QueryKey,
): Promise<OptimisticContext<T>> {
  // Cancel queries đang fetch để tránh overwrite optimistic data
  await qc.cancelQueries({ queryKey });

  // Snapshot data hiện tại — dùng để rollback nếu mutation fail
  const previousData = qc.getQueryData<T>(queryKey);

  return { previousData, queryKey };
}

/**
 * Rollback optimistic update khi mutation thất bại.
 *
 * @example
 * ```ts
 * onError: (_err, _vars, context) => {
 *   if (context) rollbackOptimisticUpdate(queryClient, context);
 *   message.error('Cập nhật thất bại, đã khôi phục trạng thái trước đó');
 * }
 * ```
 */
export function rollbackOptimisticUpdate<T>(qc: QueryClient, context: OptimisticContext<T>): void {
  qc.setQueryData(context.queryKey, context.previousData);
}

/**
 * Finalise sau mutation (cả thành công và thất bại).
 * Invalidate lại query để đồng bộ với server data.
 *
 * @example
 * ```ts
 * onSettled: () => {
 *   settleOptimisticUpdate(queryClient, queryKeys.tasks.board(groupId));
 * }
 * ```
 */
export function settleOptimisticUpdate(qc: QueryClient, queryKey: QueryKey): Promise<void> {
  return qc.invalidateQueries({ queryKey });
}
