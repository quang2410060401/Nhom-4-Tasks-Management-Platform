import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import type { TaskComment } from '@/types';
import { getTaskCommentsApi } from '../api/taskApi';

export function useTaskComments(groupId: string, taskId: string | null, enabled = true) {
  return useQuery<TaskComment[]>({
    queryKey: taskId
      ? queryKeys.tasks.comments(groupId, taskId)
      : queryKeys.tasks.comments(groupId, 'unknown'),
    queryFn: () => getTaskCommentsApi(groupId, taskId!),
    enabled: Boolean(taskId) && enabled,
    staleTime: 15_000,
  });
}
