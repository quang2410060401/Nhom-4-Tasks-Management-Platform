import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { TaskStatus } from '@/types';
import { getGroupStatusesApi } from '../api';

export function useGroupStatuses(groupId: string | undefined, enabled = true) {
  return useQuery<TaskStatus[]>({
    queryKey: groupId ? queryKeys.statuses.list(groupId) : queryKeys.statuses.list('unknown'),
    queryFn: () => getGroupStatusesApi(groupId!),
    enabled: Boolean(groupId) && enabled,
    staleTime: 60_000,
  });
}
