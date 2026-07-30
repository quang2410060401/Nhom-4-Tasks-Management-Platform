import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showCreateSuccess } from '@/services/ui';
import { createTaskCommentApi } from '../api/taskApi';
import type { CreateTaskCommentPayload } from '../types';

export function useCreateTaskComment(groupId: string, taskId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTaskCommentPayload) =>
      createTaskCommentApi(groupId, taskId!, payload),
    onSuccess: async () => {
      showCreateSuccess('bình luận');
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
