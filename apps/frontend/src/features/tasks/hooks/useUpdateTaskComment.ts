import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showUpdateSuccess } from '@/services/ui';
import { updateTaskCommentApi } from '../api/taskApi';
import type { UpdateTaskCommentPayload } from '../types';

export function useUpdateTaskComment(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      payload,
    }: {
      commentId: string;
      payload: UpdateTaskCommentPayload;
    }) => updateTaskCommentApi(groupId, taskId!, commentId, payload),
    onSuccess: async () => {
      showUpdateSuccess('bình luận');
      if (!taskId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.comments(groupId, taskId) });
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
