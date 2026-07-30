import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showDeleteSuccess } from '@/services/ui';
import { deleteTaskCommentApi } from '../api/taskApi';

export function useDeleteTaskComment(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteTaskCommentApi(groupId, taskId!, commentId),
    onSuccess: async () => {
      showDeleteSuccess('bình luận');
      if (!taskId) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.comments(groupId, taskId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(groupId, taskId) }),
      ]);
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
