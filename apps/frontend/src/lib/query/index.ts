// Query client
export { queryClient } from './queryClient';

// Query key factories
export {
  queryKeys,
  authKeys,
  groupKeys,
  memberKeys,
  inviteKeys,
  taskKeys,
  statusKeys,
  labelKeys,
  dashboardKeys,
} from './queryKeys';

// Query helpers — invalidation & optimistic update patterns
export {
  invalidateGroupScope,
  invalidateTaskRelated,
  invalidateMemberRelated,
  invalidateStatusRelated,
  invalidateLabelRelated,
  prepareOptimisticUpdate,
  rollbackOptimisticUpdate,
  settleOptimisticUpdate,
} from './queryHelpers';
export type { OptimisticContext } from './queryHelpers';
