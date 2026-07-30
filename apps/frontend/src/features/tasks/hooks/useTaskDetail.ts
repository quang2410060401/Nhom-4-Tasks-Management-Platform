import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { TaskDetail } from '@/types';
import { getTaskDetailApi } from '../api/taskApi';

export function useTaskDetail(groupId: string, taskId: string | null, enabled = true) {
  return useQuery<TaskDetail>({
    queryKey: taskId ? queryKeys.tasks.detail(groupId, taskId) : queryKeys.tasks.detail(groupId, 'unknown'),
    queryFn: () => getTaskDetailApi(groupId, taskId!),
    enabled: Boolean(taskId) && enabled,
    staleTime: 30_000,
  });
}
