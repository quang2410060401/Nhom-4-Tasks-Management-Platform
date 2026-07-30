import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { TaskListResponse } from '@/types';
import { getTaskListApi } from '../api/taskApi';
import type { TaskBoardFilters } from '../types';

export function useTaskList(
  groupId: string | undefined,
  filters: TaskBoardFilters,
  enabled = true,
) {
  return useQuery<TaskListResponse>({
    queryKey: groupId
      ? queryKeys.tasks.list(groupId, filters as Record<string, unknown>)
      : queryKeys.tasks.list('unknown', filters as Record<string, unknown>),
    queryFn: () => getTaskListApi(groupId!, filters),
    enabled: Boolean(groupId) && enabled,
    staleTime: 30_000,
  });
}
