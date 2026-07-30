import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateTaskRelated, queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showDeleteSuccess } from '@/services/ui';
import { deleteTaskApi } from '../api/taskApi';

export function useDeleteTask(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deleteTaskApi(groupId, taskId!),
    onSuccess: async () => {
      showDeleteSuccess('công việc');
      if (!taskId) {
        return;
      }
      queryClient.removeQueries({ queryKey: queryKeys.tasks.detail(groupId, taskId) });
      await invalidateTaskRelated(queryClient, groupId);
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
