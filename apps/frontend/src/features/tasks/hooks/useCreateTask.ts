import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateTaskRelated } from '@/lib/query';
import { normalizeApiError } from '@/services/http';
import { showApiError, showCreateSuccess } from '@/services/ui';
import { createTaskApi } from '../api/taskApi';
import type { CreateTaskPayload } from '../types';

export function useCreateTask(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => createTaskApi(groupId, payload),
    onSuccess: async () => {
      showCreateSuccess('công việc');
      await invalidateTaskRelated(queryClient, groupId);
    },
    onError: (error) => {
      showApiError(normalizeApiError(error));
    },
  });
}
